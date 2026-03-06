import PocketBase from 'pocketbase';

const PB_URL = import.meta.env.VITE_POCKETBASE_URL;
export const pb = new PocketBase(PB_URL);
