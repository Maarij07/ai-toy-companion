describe('WiFiTCPService', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
    jest.dontMock('react-native-tcp-socket');
  });

  it('returns false instead of throwing when socket creation fails', async () => {
    jest.doMock('react-native-tcp-socket', () => ({
      createConnection: jest.fn(() => {
        throw new Error('socket unavailable');
      }),
    }));

    const WiFiTCPService = require('../src/services/WiFiTCPService').default;

    await expect(WiFiTCPService.connect('192.168.1.44', 8765)).resolves.toBe(false);
  });

  it('times out stalled connection attempts and destroys the socket', async () => {
    jest.useFakeTimers();
    const destroy = jest.fn();

    jest.doMock('react-native-tcp-socket', () => ({
      createConnection: jest.fn(() => ({
        on: jest.fn(),
        write: jest.fn(),
        destroy,
      })),
    }));

    const WiFiTCPService = require('../src/services/WiFiTCPService').default;
    const result = WiFiTCPService.connect('192.168.1.44', 8765);

    jest.advanceTimersByTime(10_000);

    await expect(result).resolves.toBe(false);
    expect(destroy).toHaveBeenCalled();
  });

  it('reuses an existing connection instead of opening a duplicate TCP client', async () => {
    jest.useFakeTimers();
    const socket = {
      on: jest.fn(),
      write: jest.fn(),
      destroy: jest.fn(),
    };
    const createConnection = jest.fn((_options, onConnect) => {
      setTimeout(onConnect, 0);
      return socket;
    });

    jest.doMock('react-native-tcp-socket', () => ({
      createConnection,
    }));

    const WiFiTCPService = require('../src/services/WiFiTCPService').default;
    const first = WiFiTCPService.connect('192.168.1.44', 8765);
    jest.advanceTimersByTime(0);

    await expect(first).resolves.toBe(true);
    await expect(WiFiTCPService.connect('192.168.1.44', 8765)).resolves.toBe(true);

    expect(createConnection).toHaveBeenCalledTimes(1);
    expect(socket.destroy).not.toHaveBeenCalled();
  });
});

describe('Esp32DiscoveryService', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('react-native');
  });

  it('does not call NSD when Android nearby WiFi permission is denied', async () => {
    const discover = jest.fn();

    jest.doMock('react-native', () => ({
      NativeModules: {
        Esp32Nsd: { discover },
      },
      PermissionsAndroid: {
        PERMISSIONS: { NEARBY_WIFI_DEVICES: 'android.permission.NEARBY_WIFI_DEVICES' },
        RESULTS: { GRANTED: 'granted', DENIED: 'denied' },
        check: jest.fn(() => Promise.resolve(false)),
        request: jest.fn(() => Promise.resolve('denied')),
      },
      Platform: { OS: 'android', Version: 34 },
    }));

    const Esp32DiscoveryService = require('../src/services/Esp32DiscoveryService').default;

    await expect(Esp32DiscoveryService.discoverHost()).resolves.toBeNull();
    expect(discover).not.toHaveBeenCalled();
  });

  it('uses firmware UDP broadcast discovery before NSD', async () => {
    const udpResolved = {
      name: 'ESP32AUDIO',
      type: 'udp-broadcast',
      host: '192.168.1.44',
      port: 8765,
    };
    const discoverUdp = jest.fn(() => Promise.resolve(udpResolved));
    const discover = jest.fn();

    jest.doMock('react-native', () => ({
      NativeModules: {
        Esp32Nsd: { discoverUdp, discover },
      },
      PermissionsAndroid: {
        PERMISSIONS: { NEARBY_WIFI_DEVICES: 'android.permission.NEARBY_WIFI_DEVICES' },
        RESULTS: { GRANTED: 'granted' },
        check: jest.fn(() => Promise.resolve(true)),
        request: jest.fn(),
      },
      Platform: { OS: 'android', Version: 34 },
    }));

    const Esp32DiscoveryService = require('../src/services/Esp32DiscoveryService').default;

    await expect(Esp32DiscoveryService.discoverHost()).resolves.toEqual(udpResolved);
    expect(discoverUdp).toHaveBeenCalledWith(8766, 3500);
    expect(discover).not.toHaveBeenCalled();
  });

  it('returns a discovered ESP32 host when NSD resolves successfully', async () => {
    const resolved = {
      name: 'esp32audio',
      type: '_esp32audio._tcp.',
      host: '192.168.1.44',
      port: 8765,
    };
    const discover = jest.fn(() => Promise.resolve(resolved));

    jest.doMock('react-native', () => ({
      NativeModules: {
        Esp32Nsd: { discover },
      },
      PermissionsAndroid: {
        PERMISSIONS: { NEARBY_WIFI_DEVICES: 'android.permission.NEARBY_WIFI_DEVICES' },
        RESULTS: { GRANTED: 'granted' },
        check: jest.fn(() => Promise.resolve(true)),
        request: jest.fn(),
      },
      Platform: { OS: 'android', Version: 34 },
    }));

    const Esp32DiscoveryService = require('../src/services/Esp32DiscoveryService').default;

    await expect(Esp32DiscoveryService.discoverHost()).resolves.toEqual(resolved);
    expect(discover).toHaveBeenCalledWith('_tcp._tcp.', 8765, 3500);
  });

  it('requests fine location for NSD on Android 12 and older runtime-permission devices', async () => {
    const discover = jest.fn(() =>
      Promise.resolve({
        name: 'esp32audio',
        type: '_esp32audio._tcp.',
        host: '192.168.1.44',
        port: 8765,
      })
    );
    const check = jest.fn(() => Promise.resolve(false));
    const request = jest.fn(() => Promise.resolve('granted'));

    jest.doMock('react-native', () => ({
      NativeModules: {
        Esp32Nsd: { discover },
      },
      PermissionsAndroid: {
        PERMISSIONS: {
          ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
          NEARBY_WIFI_DEVICES: 'android.permission.NEARBY_WIFI_DEVICES',
        },
        RESULTS: { GRANTED: 'granted' },
        check,
        request,
      },
      Platform: { OS: 'android', Version: 32 },
    }));

    const Esp32DiscoveryService = require('../src/services/Esp32DiscoveryService').default;

    await expect(Esp32DiscoveryService.discoverHost()).resolves.toMatchObject({
      host: '192.168.1.44',
      port: 8765,
    });
    expect(check).toHaveBeenCalledWith('android.permission.ACCESS_FINE_LOCATION');
    expect(request).toHaveBeenCalledWith('android.permission.ACCESS_FINE_LOCATION');
  });
});

describe('ESP32WiFiService TCP stream parser', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('handles STREAM_START, binary WAV data, and STREAM_END in one TCP read', () => {
    jest.doMock('react-native-tcp-socket', () => ({
      createConnection: jest.fn(),
    }));

    const ESP32WiFiService = require('../src/services/ESP32WiFiService').default;
    const receivedFiles: Array<{ filename: string; data: ArrayBuffer }> = [];
    const messages: any[] = [];

    ESP32WiFiService.setAutoReceiveHandler((filename: string, data: ArrayBuffer) => {
      receivedFiles.push({ filename, data });
    });

    const textBytes = (text: string) => Uint8Array.from(Buffer.from(text, 'ascii'));
    const wavBytes = Uint8Array.from([
      82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32,
      16, 0, 0, 0, 1, 0, 1, 0, 128, 62, 0, 0, 0, 125, 0, 0,
      2, 0, 16, 0, 100, 97, 116, 97, 4, 0, 0, 0,
    ]);
    const pcmBytes = Uint8Array.from([1, 2, 3, 4]);
    const start = textBytes('STREAM_START:rec_0001.wav\n');
    const end = textBytes('STREAM_END:rec_0001.wav:4\nREADY_FOR_RESPONSE\n');
    const packet = new Uint8Array(start.length + wavBytes.length + pcmBytes.length + end.length);

    packet.set(start, 0);
    packet.set(wavBytes, start.length);
    packet.set(pcmBytes, start.length + wavBytes.length);
    packet.set(end, start.length + wavBytes.length + pcmBytes.length);

    (ESP32WiFiService as any).processIncomingBytes(packet, (msg: any) => messages.push(msg));

    expect(receivedFiles).toHaveLength(1);
    expect(receivedFiles[0].filename).toBe('rec_0001.wav');
    expect(receivedFiles[0].data.byteLength).toBe(wavBytes.length + pcmBytes.length);
    expect(messages.some(msg => msg.type === 'STREAM_START')).toBe(true);
    expect(messages.some(msg => msg.type === 'STREAM_END')).toBe(true);
    expect(messages.some(msg => msg.type === 'READY_FOR_RESPONSE')).toBe(true);
  });
});
