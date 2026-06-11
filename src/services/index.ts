// Export all services
export { AuthService } from './AuthService';
export { ToyService } from './ToyService';
export { ProductService } from './ProductService';
export { CartService } from './CartService';
export { default as PaymentService } from './PaymentService';

// Export voice processing services
// WiFi TCP transport (replaces BLE)
export { default as WiFiTCPService } from './WiFiTCPService';
export { default as ESP32WiFiService } from './ESP32WiFiService';
export type { ESP32WiFiMessage } from './ESP32WiFiService';
export { default as Esp32DiscoveryService } from './Esp32DiscoveryService';
// BLE services kept for reference (no longer used in production pipeline)
export { default as BLEService } from './BLEService';
export { default as ESP32Service } from './ESP32Service';
export type { ESP32Message } from './ESP32Service';
export { NUS_SERVICE_UUID, NUS_RX_UUID, NUS_TX_UUID } from './ESP32Service';
export { default as WhisperService } from './WhisperService';
export { default as GoogleSTTService } from './GoogleSTTService';
export { default as LLMService } from './LLMService';
export { default as TTSService } from './TTSService';
export { default as VoiceProcessingService } from './VoiceProcessingService';


// Export Supabase client and types
export { supabase } from '../config/supabase';
export type {
  Profile,
  Toy,
  ToyOwner,
  ToyInterest,
  Product,
  CartItem,
  Order,
  OrderItem
} from '../config/supabase';
