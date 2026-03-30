import { BleManager, Device } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';

class BLEService {
  private manager: BleManager;
  private isConnected: boolean = false;
  private device: Device | null = null;
  private onDisconnectCallback: (() => void) | null = null;
  private lastDeviceId: string | null = null;

  constructor() {
    this.manager = new BleManager();
  }

  setOnDisconnect(cb: () => void): void {
    this.onDisconnectCallback = cb;
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        // Android 12+ requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);

        const allGranted = Object.values(results).every(
          result => result === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          console.warn('Bluetooth permissions denied:', results);
          return false;
        }
      } else {
        // Android < 12 requires location permission for BLE scanning
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);

        const allGranted = Object.values(results).every(
          result => result === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          console.warn('Location permissions denied (required for BLE on Android < 12):', results);
          return false;
        }
      }
    }
    // iOS permissions are handled via Info.plist — no runtime request needed
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
      console.log(`BLE connected, pre-MTU=${this.device.mtu ?? 'unknown'}`);

      // Android needs a brief settle before MTU negotiation, and MTU must be
      // requested BEFORE service discovery to guarantee the firmware sees it.
      await new Promise(r => setTimeout(r, 150));
      try {
        const devMtu = await this.manager.requestMTUForDevice(deviceId, 512);
        this.device = devMtu;
        console.log(`BLE MTU negotiated: ${this.device.mtu}`);
      } catch (e) {
        console.warn(`BLE MTU request failed (mtu=${this.device?.mtu ?? 23}):`, e);
      }

      // Discover services after MTU is set
      await this.device.discoverAllServicesAndCharacteristics();

      // Listen for unexpected disconnections (device turned off, out of range, etc.)
      this.device.onDisconnected((_error, _device) => {
        if (this.isConnected) {
          console.log('BLE device disconnected unexpectedly');
          this.isConnected = false;
          this.device = null;
          this.onDisconnectCallback?.();
        }
      });

      this.isConnected = true;
      this.lastDeviceId = deviceId;
      console.log('Connected to device:', deviceId);
    } catch (error) {
      console.error('Error connecting to device:', error);
      this.isConnected = false;
      this.device = null;
    }
  }

  async disconnect(): Promise<void> {
    const device = this.device;
    this.isConnected = false;
    this.device = null;
    if (device) {
      try {
        await device.cancelConnection();
      } catch (error) {
        // Device may already be disconnected — ignore
      }
    }
  }

  /** Reconnect to the last known device by ID (no scan needed). */
  async reconnect(serviceUUID: string): Promise<boolean> {
    if (!this.lastDeviceId) {
      // No remembered device — fall back to a fresh scan
      return this.scanAndConnect(serviceUUID);
    }
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return false;
      await this.connectToDevice(this.lastDeviceId);
      return this.isConnected;
    } catch {
      // Device not available via direct connect — fall back to scan
      return this.scanAndConnect(serviceUUID);
    }
  }

  /** Expose MTU negotiation so callers can trigger it at the right time. */
  async negotiateMTU(targetMtu = 512): Promise<number> {
    if (!this.device) return 23;
    try {
      const d = await this.manager.requestMTUForDevice(this.device.id, targetMtu);
      this.device = d;
      console.log(`BLE negotiateMTU result: ${d.mtu}`);
      return d.mtu ?? 23;
    } catch (e) {
      console.warn(`BLE negotiateMTU failed (current=${this.device?.mtu ?? 23}):`, e);
      return this.device?.mtu ?? 23;
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

  startScan(onDeviceFound: (device: Device) => void, onError?: (error: any) => void): void {
    this.manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('BLE scan error:', error);
        if (onError) onError(error);
        return;
      }
      if (device) {
        onDeviceFound(device);
      }
    });
  }

  stopScan(): void {
    this.manager.stopDeviceScan();
  }

  async connectById(deviceId: string): Promise<boolean> {
    try {
      this.device = await this.manager.connectToDevice(deviceId);
      await this.device.discoverAllServicesAndCharacteristics();
      this.isConnected = true;
      console.log('Connected to device:', deviceId);
      return true;
    } catch (error) {
      console.error('Error connecting to device:', error);
      this.isConnected = false;
      return false;
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