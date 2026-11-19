package app.valenced.manager.ui.viewmodel.home

import android.content.pm.PackageManager
import java.security.MessageDigest
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import app.valenced.manager.network.dto.MobileUpdate
import app.valenced.manager.network.dto.Asset
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.cachedIn
import app.valenced.manager.BuildConfig
import app.valenced.manager.R
import app.valenced.manager.domain.manager.BundleManager
import app.valenced.manager.domain.manager.DownloadManager
import app.valenced.manager.domain.manager.DownloadResult
import app.valenced.manager.domain.manager.InstallManager
import app.valenced.manager.domain.manager.InstallMethod
import app.valenced.manager.domain.manager.PathManager
import app.valenced.manager.domain.manager.PreferenceManager
import app.valenced.manager.domain.repository.RestRepository
import app.valenced.manager.installer.Installer
import app.valenced.manager.installer.session.SessionInstaller
import app.valenced.manager.installer.shizuku.ShizukuInstaller
import app.valenced.manager.installer.shizuku.ShizukuPermissions
import app.valenced.manager.network.dto.Release
import app.valenced.manager.network.utils.CommitsPagingSource
import app.valenced.manager.network.utils.dataOrNull
import app.valenced.manager.utils.DiscordVersion
import app.valenced.manager.utils.isMiui
import app.valenced.manager.utils.showToast
import cafe.adriel.voyager.core.model.ScreenModel
import cafe.adriel.voyager.core.model.screenModelScope
import kotlinx.coroutines.launch

class HomeViewModel(
    private val repo: RestRepository,
    val context: Context,
    val prefs: PreferenceManager,
    val installManager: InstallManager,
    val bundleManager: BundleManager,
    private val downloadManager: DownloadManager,
    private val paths: PathManager
) : ScreenModel {

    var release by mutableStateOf<Release?>(null)
        private set

    private var mobileUpdate: MobileUpdate? = null
    var updateStatus by mutableStateOf("Verificando atualizações…")
        private set

    private var updateDownloadUrl by mutableStateOf<String?>(null)
    var showUpdateDialog by mutableStateOf(false)
    var isUpdating by mutableStateOf(false)
    val commits = Pager(PagingConfig(pageSize = 30)) { CommitsPagingSource(repo) }.flow.cachedIn(
        screenModelScope
    )

    init {
        screenModelScope.launch {
            // A failure is kept in BundleManager.problem for the screen to show.
            if (runCatching { bundleManager.load(refresh = true) }.isSuccess && prefs.autoClearCache) autoClearCache()
        }
        screenModelScope.launch {
            while (true) {
                checkForUpdate()
                delay(30 * 60 * 1000L)
            }
        }
    }

    fun launchMod() {
        installManager.current?.let {
            val intent = context.packageManager.getLaunchIntentForPackage(it.packageName)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
    }

    fun uninstallMod() {
        installManager.uninstall()
    }

    fun launchModInfo() {
        installManager.current?.let {
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                data = Uri.parse("package:${it.packageName}")
                context.startActivity(this)
            }
        }
    }

    private fun autoClearCache() {
        val currentVersion =
            DiscordVersion.fromVersionCode(installManager.current?.versionCode.toString()) ?: return
        val targetVersion = bundleManager.discordVersion ?: return

        if (targetVersion > currentVersion) paths.discordDownloadsDir.deleteRecursively()
    }

    fun checkForUpdate() {
        screenModelScope.launch {
            val update = repo.getMobileUpdate().dataOrNull
            if (update == null || !update.valid()) {
                updateStatus = "Canal de atualização indisponível. Tente novamente mais tarde."
                return@launch
            }
            mobileUpdate = update
            if (update.versionCode > BuildConfig.VERSION_CODE) {
                updateDownloadUrl = update.apkUrl
                release = Release("mobile-v${update.versionName}", update.versionName,
                    listOf(Asset("ByaFluxMobile-${update.versionName}.apk", update.apkUrl)))
                updateStatus = "ByaFlux ${update.versionName} disponível"
                showUpdateDialog = true
            } else {
                updateStatus = "Você está na versão mais recente."
                showUpdateDialog = false
            }
        }
    }

    @Suppress("DEPRECATION")
    private suspend fun verifyUpdate(file: java.io.File, expected: MobileUpdate): Boolean = withContext(Dispatchers.IO) {
        if (file.length() != expected.apkSize) return@withContext false
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(65536)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        if (digest.digest().joinToString("") { "%02x".format(it) } != expected.sha256) return@withContext false
        val pm = context.packageManager
        val archive = pm.getPackageArchiveInfo(file.absolutePath, PackageManager.GET_SIGNING_CERTIFICATES)
            ?: return@withContext false
        if (archive.packageName != BuildConfig.APPLICATION_ID || archive.longVersionCode != expected.versionCode) return@withContext false
        val installed = pm.getPackageInfo(BuildConfig.APPLICATION_ID, PackageManager.GET_SIGNING_CERTIFICATES)
        val current = installed.signingInfo?.apkContentsSigners ?: return@withContext false
        val incoming = archive.signingInfo?.apkContentsSigners ?: return@withContext false
        incoming.isNotEmpty() && current.toSet() == incoming.toSet()
    }

    fun downloadAndInstallUpdate(onProgressUpdate: (Float?) -> Unit) {
        if (isUpdating) return
        val expected = mobileUpdate ?: return
        if (!expected.valid() || expected.versionCode <= BuildConfig.VERSION_CODE) return
        screenModelScope.launch {
            val update = paths.updateApk
            if (update.exists()) update.delete()
            isUpdating = true
            val downloadResult =
                downloadManager.downloadUpdate(expected.apkUrl, update, onProgressUpdate)

            if (downloadResult !is DownloadResult.Success) {
                isUpdating = false
                if (downloadResult is DownloadResult.Error) {
                    Log.e("HomeViewModel", "Download failed: ${downloadResult.debugReason}")
                    context.showToast(R.string.msg_download_failed)
                }
                return@launch
            }

            if (!runCatching { verifyUpdate(update, expected) }.getOrDefault(false)) {
                update.delete()
                isUpdating = false
                updateStatus = "Atualização recusada: arquivo ou assinatura incompatível."
                showUpdateDialog = false
                return@launch
            }
            isUpdating = false
            val installMethod = if (prefs.installMethod == InstallMethod.SHIZUKU && !ShizukuPermissions.waitShizukuPermissions()) {
                // Temporarily use DEFAULT if SHIZUKU permissions are not granted
                    context.showToast(R.string.msg_shizuku_denied)
                    InstallMethod.DEFAULT
                } else {
                    prefs.installMethod
                }

            val installer: Installer = when (installMethod) {
                InstallMethod.DEFAULT -> SessionInstaller(context)
                InstallMethod.SHIZUKU -> ShizukuInstaller(context)
            }

            installer.installApks(silent = !isMiui, update)
        }
    }

}