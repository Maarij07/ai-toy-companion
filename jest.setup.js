jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({ data: { idToken: 'test-token', user: {} } })),
  },
}));

jest.mock('react-native-ble-plx', () => ({
  BleManager: jest.fn().mockImplementation(() => ({
    state: jest.fn(() => Promise.resolve('PoweredOn')),
    startDeviceScan: jest.fn(),
    stopDeviceScan: jest.fn(),
    connectToDevice: jest.fn(),
    requestMTUForDevice: jest.fn(),
  })),
}));

jest.mock('react-native-tcp-socket', () => ({
  createConnection: jest.fn((_options, onConnect) => {
    const socket = {
      on: jest.fn(),
      write: jest.fn(),
      destroy: jest.fn(),
    };
    setTimeout(onConnect, 0);
    return socket;
  }),
}));

jest.mock('@stripe/stripe-react-native', () => ({
  CardField: 'CardField',
  useStripe: () => ({
    confirmPayment: jest.fn(),
  }),
}));
