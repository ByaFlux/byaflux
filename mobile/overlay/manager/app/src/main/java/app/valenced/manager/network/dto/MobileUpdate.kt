package app.valenced.manager.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class MobileUpdate(
    val versionName: String,
    val versionCode: Long,
    val apkUrl: String,
    val apkSize: Long,
    val sha256: String,
    val packageId: String = "app.byaflux.manager"
) {
    fun valid(): Boolean = packageId == "app.byaflux.manager" &&
        versionCode > 0 && apkSize in 1..500_000_000 &&
        sha256.matches(Regex("[0-9a-f]{64}")) &&
        apkUrl.startsWith("https://github.com/ByaFlux/byaflux/releases/download/mobile-v") &&
        apkUrl.endsWith(".apk") && !apkUrl.contains("?") && !apkUrl.contains("#")
}
