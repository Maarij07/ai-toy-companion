import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

export interface Esp32NsdService {
  name: string;
  type: string;
  host: string;
  port: number;
}

const DEFAULT_SERVICE_TYPES = ['_tcp._tcp.', '_esp32audio._tcp.'];

const Esp32Nsd = NativeModules.Esp32Nsd as
  | {
      discoverUdp?: (port: number, timeoutMs: number) => Promise<Esp32NsdService>;
      discover: (serviceType: string, timeoutMs: number) => Promise<Esp32NsdService>;
    }
  | undefined;

class Esp32DiscoveryService {
  async discoverHost(
    serviceTypes = DEFAULT_SERVICE_TYPES,
    timeoutMs = 3500
  ): Promise<Esp32NsdService | null> {
    if (Platform.OS !== 'android' || !Esp32Nsd?.discover) {
      return null;
    }

    const hasPermission = await this.ensureNearbyWifiPermission();
    if (!hasPermission) {
      console.warn('ESP32 discovery: nearby WiFi permission was not granted');
      return null;
    }

    const udpResult = await this.discoverViaUdp(timeoutMs);
    if (udpResult) return udpResult;

    for (const serviceType of serviceTypes) {
      try {
        const result = await Esp32Nsd.discover(serviceType, timeoutMs);
        if (result?.host && result?.port) {
          console.log(
            `ESP32 discovery: found ${result.name} at ${result.host}:${result.port} (${result.type})`
          );
          return result;
        }
      } catch (error) {
        console.warn(`ESP32 discovery: ${serviceType} not found`, error);
      }
    }

    return null;
  }

  private async discoverViaUdp(timeoutMs: number): Promise<Esp32NsdService | null> {
    if (!Esp32Nsd?.discoverUdp) {
      return null;
    }

    try {
      const result = await Esp32Nsd.discoverUdp(8766, timeoutMs);
      if (result?.host && result?.port) {
        console.log(
          `ESP32 discovery: UDP found ${result.host}:${result.port} (${result.name})`
        );
        return result;
      }
    } catch (error) {
      console.warn('ESP32 discovery: UDP broadcast not found', error);
    }

    return null;
  }

  private async ensureNearbyWifiPermission(): Promise<boolean> {
    const androidVersion =
      typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(String(Platform.Version), 10);

    if (!Number.isFinite(androidVersion) || androidVersion < 23) {
      return true;
    }

    const permission =
      androidVersion >= 33
        ? PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES ||
          'android.permission.NEARBY_WIFI_DEVICES'
        : PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const alreadyGranted = await PermissionsAndroid.check(permission);
    if (alreadyGranted) return true;

    const result = await PermissionsAndroid.request(permission);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
}

export default new Esp32DiscoveryService();
