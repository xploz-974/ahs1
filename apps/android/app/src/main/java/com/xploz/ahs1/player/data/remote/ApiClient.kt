package com.xploz.ahs1.player.data.remote

import com.xploz.ahs1.player.BuildConfig
import com.xploz.ahs1.player.data.TokenStore
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

// Ajoute automatiquement le Bearer token du player courant sur chaque appel
// authentifié. /enroll et /refresh n'ont pas besoin de token — l'absence de
// token stocké laisse simplement l'en-tête Authorization absent, l'API
// répond 401 pour ces deux routes de toute façon si jamais elle l'exigeait.
private class AuthInterceptor(private val tokenStore: TokenStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request().newBuilder().apply {
            tokenStore.accessToken?.let { addHeader("Authorization", "Bearer $it") }
        }.build()
        return chain.proceed(request)
    }
}

object ApiClient {
    fun create(tokenStore: TokenStore): AhsApi {
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY else HttpLoggingInterceptor.Level.NONE
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(tokenStore))
            .addInterceptor(logging)
            .build()

        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(AhsApi::class.java)
    }
}
