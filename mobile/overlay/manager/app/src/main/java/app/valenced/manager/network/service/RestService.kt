package app.valenced.manager.network.service

import app.valenced.manager.network.dto.Commit
import app.valenced.manager.network.dto.Release
import app.valenced.manager.network.dto.MobileUpdate
import io.ktor.client.request.parameter
import io.ktor.client.request.url
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class RestService(
    private val httpService: HttpService
) {

    suspend fun getMobileUpdate() = withContext(Dispatchers.IO) {
        httpService.request<MobileUpdate> {
            url("https://raw.githubusercontent.com/ByaFlux/byaflux/mobile-updates/android.json")
        }
    }

    suspend fun getLatestRelease(repo: String) = withContext(Dispatchers.IO) {
        httpService.request<Release> {
            url("https://api.github.com/repos/$repo/releases/latest")
        }
    }

    suspend fun getCommits(repo: String, page: Int = 1) = withContext(Dispatchers.IO) {
        httpService.request<List<Commit>> {
            url("https://api.github.com/repos/$repo/commits")
            parameter("page", page)
        }
    }

}