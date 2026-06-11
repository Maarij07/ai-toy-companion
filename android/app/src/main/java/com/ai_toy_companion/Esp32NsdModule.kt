package com.example.aitoycompanion

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.SocketTimeoutException
import java.util.concurrent.atomic.AtomicBoolean

class Esp32NsdModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "Esp32Nsd"

  private val nsdManager: NsdManager by lazy {
    reactContext.getSystemService(Context.NSD_SERVICE) as NsdManager
  }
  private val mainHandler = Handler(Looper.getMainLooper())

  @ReactMethod
  fun discoverUdp(port: Double, timeoutMs: Double, promise: Promise) {
    Thread {
      val listenPort = port.toInt().coerceIn(1, 65535)
      val timeout = timeoutMs.toInt().coerceAtLeast(1000)

      try {
        DatagramSocket(null).use { socket ->
          socket.reuseAddress = true
          socket.soTimeout = timeout
          socket.bind(InetSocketAddress(listenPort))
          socket.broadcast = true

          val buffer = ByteArray(128)
          val packet = DatagramPacket(buffer, buffer.size)
          socket.receive(packet)

          val message = String(packet.data, packet.offset, packet.length, Charsets.UTF_8).trim()
          val parts = message.split(":")
          if (parts.size != 3 || parts[0] != "ESP32AUDIO") {
            promise.reject("UDP_BAD_PACKET", "Unexpected ESP32 discovery packet: $message")
            return@Thread
          }

          val host = parts[1].trim()
          val tcpPort = parts[2].trim().toIntOrNull()
          if (host.isEmpty() || tcpPort == null || tcpPort <= 0) {
            promise.reject("UDP_BAD_PACKET", "Invalid ESP32 discovery packet: $message")
            return@Thread
          }

          val result = Arguments.createMap().apply {
            putString("name", "ESP32AUDIO")
            putString("type", "udp-broadcast")
            putString("host", host)
            putInt("port", tcpPort)
          }
          promise.resolve(result)
        }
      } catch (_: SocketTimeoutException) {
        promise.reject("UDP_TIMEOUT", "No ESP32 UDP discovery packet on port $listenPort in ${timeout}ms")
      } catch (error: Exception) {
        promise.reject("UDP_DISCOVER_ERROR", error.message ?: "Unable to listen for ESP32 UDP discovery")
      }
    }.start()
  }

  @ReactMethod
  fun discover(serviceType: String?, timeoutMs: Double, promise: Promise) {
    val requestedType = normalizeServiceType(serviceType)
    val settled = AtomicBoolean(false)
    val resolving = AtomicBoolean(false)
    var listener: NsdManager.DiscoveryListener? = null
    var multicastLock: WifiManager.MulticastLock? = null
    var timeoutRunnable: Runnable? = null

    fun cleanup() {
      timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
      listener?.let {
        try {
          nsdManager.stopServiceDiscovery(it)
        } catch (_: Exception) {
        }
      }
      multicastLock?.let {
        if (it.isHeld) it.release()
      }
    }

    fun finishWithError(code: String, message: String) {
      if (!settled.compareAndSet(false, true)) return
      cleanup()
      promise.reject(code, message)
    }

    fun finishWithService(serviceInfo: NsdServiceInfo) {
      if (!settled.compareAndSet(false, true)) return
      cleanup()

      val hostAddress = getHostAddress(serviceInfo)
      if (hostAddress == null) {
        promise.reject("NSD_NO_HOST", "Resolved ESP32 service did not include a host address")
        return
      }

      val result = Arguments.createMap().apply {
        putString("name", serviceInfo.serviceName)
        putString("type", serviceInfo.serviceType)
        putString("host", hostAddress)
        putInt("port", serviceInfo.port)
      }
      promise.resolve(result)
    }

    val timeout = timeoutMs.toLong().coerceAtLeast(1000L)
    timeoutRunnable = Runnable {
      finishWithError("NSD_TIMEOUT", "No ESP32 NSD service found for $requestedType in ${timeout}ms")
    }

    try {
      val wifiManager = reactContext.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
      multicastLock = wifiManager.createMulticastLock("ai-toy-esp32-nsd").apply {
        setReferenceCounted(false)
        acquire()
      }
    } catch (_: Exception) {
      // Discovery can still work on some Android devices without this lock.
    }

    listener = object : NsdManager.DiscoveryListener {
      override fun onDiscoveryStarted(regType: String) {
      }

      override fun onServiceFound(service: NsdServiceInfo) {
        if (settled.get()) return
        if (!service.serviceType.equals(requestedType, ignoreCase = true)) return
        if (!resolving.compareAndSet(false, true)) return

        try {
          nsdManager.resolveService(service, object : NsdManager.ResolveListener {
            override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
              resolving.set(false)
              if (!settled.get()) {
                // Keep discovery alive; another announcement may resolve correctly.
              }
            }

            override fun onServiceResolved(serviceInfo: NsdServiceInfo) {
              resolving.set(false)
              if (serviceInfo.port <= 0) return
              finishWithService(serviceInfo)
            }
          })
        } catch (error: Exception) {
          resolving.set(false)
          if (!settled.get()) {
            // Keep discovery alive; resolveService can transiently fail when Android is busy.
          }
        }
      }

      override fun onServiceLost(service: NsdServiceInfo) {
      }

      override fun onDiscoveryStopped(serviceType: String) {
      }

      override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
        finishWithError("NSD_START_FAILED", "NSD discovery failed to start: $errorCode")
      }

      override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {
      }
    }

    reactContext.runOnUiQueueThread {
      timeoutRunnable?.let { mainHandler.postDelayed(it, timeout) }
      try {
        nsdManager.discoverServices(requestedType, NsdManager.PROTOCOL_DNS_SD, listener)
      } catch (error: Exception) {
        timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        finishWithError("NSD_DISCOVER_ERROR", error.message ?: "Unable to start NSD discovery")
      }
    }
  }

  private fun normalizeServiceType(serviceType: String?): String {
    val trimmed = serviceType?.trim().orEmpty()
    if (trimmed.isEmpty()) return "_esp32audio._tcp."
    return if (trimmed.endsWith(".")) trimmed else "$trimmed."
  }

  private fun getHostAddress(serviceInfo: NsdServiceInfo): String? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      val ipv4Host = serviceInfo.hostAddresses.firstOrNull { !it.isLoopbackAddress && it.hostAddress?.contains(".") == true }
      if (ipv4Host != null) return ipv4Host.hostAddress

      val firstHost = serviceInfo.hostAddresses.firstOrNull { !it.isLoopbackAddress }
      if (firstHost != null) return firstHost.hostAddress
    }

    @Suppress("DEPRECATION")
    val host: InetAddress? = serviceInfo.host
    return host?.hostAddress
  }
}
