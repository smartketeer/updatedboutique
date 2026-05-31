import axios from 'axios';
import { useAuthStore } from './store/authStore';
window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 401) {
            useAuthStore.getState().clear();
        }
        return Promise.reject(error);
    }
);
