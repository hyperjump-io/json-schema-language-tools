export const subscribe: <T>(message: string, fn: SubscriptionFn<T>) => string;
export const unsubscribe: (message: string, token: string) => void;
export const publish: <T>(message: string, data: T) => void;
export const publishAsync: <T>(message: string, data: T) => Promise<void>;

export type SubscriptionFn<T> = SubscriptionSyncFn<T> | SubscriptionAsyncFn<T>;
export type SubscriptionSyncFn<T> = (message: string, data: T) => void;
export type SubscriptionAsyncFn<T> = (message: string, data: T) => Promise<void>;
