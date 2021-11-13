import axios, { AxiosError } from 'axios';
import { parseCookies, setCookie } from 'nookies';

let cookies = parseCookies()
let isRefreshing = false;
let failedRequestsQueue = [];

export const api = axios.create({
  baseURL: 'http://localhost:3333',
  headers: {
    Authorization: `Bearer ${cookies['nextauth.token']}`
  }
});

api.interceptors.response.use(response => {
  return response;
}, (error: AxiosError) => {
  if (error.response.status === 401) {
    if (error.response.data.code === 'token.expired') {
      cookies = parseCookies();

      const { 'nextauth.refreshToken': refreshToken } = cookies;
      const originalConfig = error.config;

      if (!isRefreshing) {
        isRefreshing = true;

        api.post('/refresh', { refreshToken })
          .then(({ data }) => {
            setCookie(undefined, 'nextauth.token', data.token, {
              maxAge: 60 * 60 * 24 * 30, // 30 days
              path: '/',
            });
            setCookie(undefined, 'nextauth.refreshToken', data.refreshToken, {
              maxAge: 60 * 60 * 24 * 30, // 30 days
              path: '/',
            });

            api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;

            failedRequestsQueue.forEach(request => request.onSuccess(data.token));
            failedRequestsQueue = [];
          })
          .catch((error) => {
            failedRequestsQueue.forEach(request => request.onFailure(error));
            failedRequestsQueue = [];
          })
          .finally(() => {
            isRefreshing = false;
          })
      }

      return new Promise((resolve, reject) => {
        failedRequestsQueue.push({
          onSuccess: (token: string) => {
            originalConfig.headers['Authorization'] = `Bearer ${token}`;
            resolve(api(originalConfig));
          },
          onFailure: (error: AxiosError) => {
            reject(error);
          }
        })
      })
    } else {

    }
  }
  return Promise.reject(error);
})
