package app.valenced.manager

import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

/** Called only after Android reports installation success. */
object ByaFluxStats {
    fun installed() {
        Thread({
            var connection: HttpURLConnection? = null
            try {
                connection = URL("https://byaflux.discloud.dev/api/client/install").openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.connectTimeout = 2000
                connection.readTimeout = 2000
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                val payload = JSONObject().put("platform", "android").put("version", BuildConfig.VERSION_NAME).toString()
                connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
                connection.responseCode
            } catch (_: Exception) {
                // Statistics must never interrupt installation or display a login.
            } finally { connection?.disconnect() }
        }, "ByaFlux-install-stats").start()
    }
}
