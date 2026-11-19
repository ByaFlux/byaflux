package app.valenced.manager.installer.step.download

import app.valenced.manager.BuildConfig
import android.content.Context
import app.valenced.manager.installer.step.StepRunner
import androidx.compose.runtime.Stable
import app.valenced.manager.R
import app.valenced.manager.domain.manager.BundleManager
import app.valenced.manager.installer.step.download.base.DownloadStep
import org.koin.core.component.inject
import java.io.File

/**
 * Downloads the Valenced Xposed module from the release the patch bundle is from
 *
 * https://github.com/Valenced/valenced
 */
@Stable
class DownloadModStep(
    workingDir: File
): DownloadStep() {

    private val bundleManager: BundleManager by inject()

    override val nameRes = R.string.step_dl_mod

    override val downloadFullUrl: String
        get() = bundleManager.bundle?.moduleUrl ?: error("The patch bundle isn't loaded")
    override val destination get() = if (BuildConfig.BUNDLED_PREVIEW) context.filesDir.resolve("byaflux-loader.apk") else preferenceManager.moduleLocation
    override val workingCopy = workingDir.resolve("xposed.apk")

    private val context: Context by inject()

    override suspend fun run(runner: StepRunner) {
        if (BuildConfig.BUNDLED_PREVIEW) {
            destination.parentFile?.mkdirs()
            context.assets.open("byaflux-loader.apk").use { input ->
                destination.outputStream().use { output -> input.copyTo(output) }
            }
        }
        super.run(runner)
    }

}
