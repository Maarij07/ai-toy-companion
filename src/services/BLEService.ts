import { BleManager, Device } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';

class BLEService {
  private manager: BleManager;
  private isConnected: boolean = false;
  private device: Device | null = null;

  constructor() {
    this.manager = new BleManager();
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        {
          title: 'Bluetooth Permission',
          message: 'This app needs Bluetooth permission to connect to your AI toy.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('Bluetooth permission denied');
        return false;
      }
    }
    return true;
  }

  async scanAndConnect(serviceUUID: string): Promise<boolean> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return false;
      }

      return new Promise((resolve, reject) => {
        // Start scanning for devices
        this.manager.startDeviceScan([serviceUUID], null, (error, scannedDevice) => {
          if (error) {
            console.error('BLE scan error:', error);
            this.manager.stopDeviceScan();
            reject(error);
            return;
          }

          if (scannedDevice) {
            console.log('Found device:', scannedDevice.name, scannedDevice.id);

            // Stop scanning when device is found
            this.manager.stopDeviceScan();

            // Attempt to connect to the device
            this.connectToDevice(scannedDevice.id)
              .then(() => {
                resolve(true);
              })
              .catch((error) => {
                console.error('Connection failed:', error);
                reject(error);
              });
          }
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          this.manager.stopDeviceScan();
          reject(new Error('Device scan timeout'));
        }, 10000);
      });
    } catch (error) {
      console.error('Error scanning for devices:', error);
      return false;
    }
  }

  private async connectToDevice(deviceId: string): Promise<void> {
    try {
      this.device = await this.manager.connectToDevice(deviceId);
      
      // Discover services and characteristics
      await this.device.discoverAllServicesAndCharacteristics();
      
      this.isConnected = true;
      console.log('Connected to device:', deviceId);
    } catch (error) {
      console.error('Error connecting to device:', error);
      this.isConnected = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.device && this.isConnected) {
      try {
        await this.device.cancelConnection();
        this.isConnected = false;
        console.log('Disconnected from device');
      } catch (error) {
        console.error('Error disconnecting from device:', error);
      }
    }
  }

  async readCharacteristic(serviceUUID: string, characteristicUUID: string): Promise<any> {
    if (!this.isConnected || !this.device) {
      throw new Error('Device not connected');
    }

    try {
      const characteristic = await this.device.readCharacteristicForService(
        serviceUUID,
        characteristicUUID
      );
      return characteristic.value;
    } catch (error) {
      console.error('Error reading characteristic:', error);
      throw error;
    }
  }

  async writeCharacteristic(serviceUUID: string, characteristicUUID: string, data: string | ArrayBuffer): Promise<void> {
    if (!this.isConnected || !this.device) {
      throw new Error('Device not connected');
    }

    try {
      let dataToSend: string;
      
      if (data instanceof ArrayBuffer) {
        // Convert ArrayBuffer to base64 string for BLE transmission
        const uint8Array = new Uint8Array(data);
        let binary = '';
        for (let i = 0; i < uint8Array.byteLength; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        dataToSend = btoa(binary);
      } else {
        dataToSend = data;
      }
      
      await this.device.writeCharacteristicWithResponseForService(
        serviceUUID,
        characteristicUUID,
        dataToSend
      );
    } catch (error) {
      console.error('Error writing to characteristic:', error);
      throw error;
    }
  }

  async subscribeToCharacteristic(
    serviceUUID: string,
    characteristicUUID: string,
    callback: (value: any) => void
  ): Promise<void> {
    if (!this.isConnected || !this.device) {
      throw new Error('Device not connected');
    }

    try {
      this.device.monitorCharacteristicForService(
        serviceUUID,
        characteristicUUID,
        (error, characteristic) => {
          if (error) {
            console.error('Error monitoring characteristic:', error);
            return;
          }

          if (characteristic?.value) {
            callback(characteristic.value);
          }
        }
      );
    } catch (error) {
      console.error('Error subscribing to characteristic:', error);
      throw error;
    }
  }

  /**
   * Subscribe to audio chunks from toy microphone
   */
  async subscribeToAudioChunks(
    serviceUUID: string,
    audioCharacteristicUUID: string,
    onChunkReceived: (chunk: ArrayBuffer) => void,
    onComplete: () => void
  ): Promise<void> {
    if (!this.isConnected || !this.device) {
      throw new Error('Device not connected');
    }

    try {
      this.device.monitorCharacteristicForService(
        serviceUUID,
        audioCharacteristicUUID,
        (error, characteristic) => {
          if (error) {
            console.error('Error monitoring audio characteristic:', error);
            return;
          }

          if (characteristic?.value) {
            // Decode base64 to ArrayBuffer
            const base64Data = characteristic.value;
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Check for end-of-stream marker (you can customize this)
            const isEndMarker = bytes.length === 4 && 
                               bytes[0] === 0xFF && 
                               bytes[1] === 0xFF && 
                               bytes[2] === 0xFF && 
                               bytes[3] === 0xFF;
            
            if (isEndMarker) {
              onComplete();
            } else {
              onChunkReceived(bytes.buffer);
            }
          }
        }
      );
    } catch (error) {
      console.error('Error subscribing to audio chunks:', error);
      throw error;
    }
  }

  /**
   * Send audio chunks to toy speaker
   */
  async sendAudioChunks(
    serviceUUID: string,
    audioCharacteristicUUID: string,
    audioData: ArrayBuffer,
    chunkSize: number = 512
  ): Promise<void> {
    if (!this.isConnected || !this.device) {
      throw new Error('Device not connected');
    }

    try {
      const uint8Array = new Uint8Array(audioData);
      const totalChunks = Math.ceil(uint8Array.length / chunkSize);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, uint8Array.length);
        const chunk = uint8Array.slice(start, end);

        // Convert to base64 for BLE transmission
        let binary = '';
        for (let j = 0; j < chunk.length; j++) {
          binary += String.fromCharCode(chunk[j]);
        }
        const base64Chunk = btoa(binary);

        await this.device.writeCharacteristicWithResponseForService(
          serviceUUID,
          audioCharacteristicUUID,
          base64Chunk
        );

        // Small delay between chunks to prevent overwhelming the device
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Send end-of-stream marker
      const endMarker = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]);
      let binary = '';
      for (let i = 0; i < endMarker.length; i++) {
        binary += String.fromCharCode(endMarker[i]);
      }
      await this.device.writeCharacteristicWithResponseForService(
        serviceUUID,
        audioCharacteristicUUID,
        btoa(binary)
      );

      console.log(`Sent ${totalChunks} audio chunks to toy`);
    } catch (error) {
      console.error('Error sending audio chunks:', error);
      throw error;
    }
  }

  getManager(): BleManager {
    return this.manager;
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  getDevice(): Device | null {
    return this.device;
  }
}

export default new BLEService();