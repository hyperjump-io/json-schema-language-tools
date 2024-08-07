/** @typedef {SubscriptionSyncFn<T> | SubscriptionAsyncFn<T>} SubscriptionFn<T> @template T */
/** @typedef {(message: string, data: T) => void} SubscriptionSyncFn<T> @template T */
/** @typedef {(message: string, data: T) => Promise<void>} SubscriptionAsyncFn<T> @template T */


/** @type Record<string, Record<string, SubscriptionFn<any>>> */
const subscriptions = {};
let uid = 0;

/** @type <T>(message: string, fn: SubscriptionFn<T>) => string */
export const subscribe = (message, fn) => {
  if (!(message in subscriptions)) {
    subscriptions[message] = {};
  }

  const subscriptionId = `pubsub_subscription_${uid++}`;
  subscriptions[message][subscriptionId] = fn;

  return subscriptionId;
};

/** @type (message: string, token: string) => void */
export const unsubscribe = (message, token) => {
  delete subscriptions[message][token];
};

/** @type <T>(message: string, data: T) => void */
export const publish = (message, data) => {
  for (const subscribedMessage in subscriptions) {
    if (subscribedMessage === message || message.startsWith(`${subscribedMessage}.`)) {
      for (const subscriptionId in subscriptions[subscribedMessage]) {
        subscriptions[subscribedMessage][subscriptionId](message, data);
      }
    }
  }
};

/** @type <T>(message: string, data: T) => Promise<void> */
export const publishAsync = async (message, data) => {
  const promises = [];
  for (const subscribedMessage in subscriptions) {
    if (subscribedMessage === message || message.startsWith(`${subscribedMessage}.`)) {
      for (const subscriptionId in subscriptions[subscribedMessage]) {
        promises.push(subscriptions[message][subscriptionId](message, data));
      }
    }
  }

  await Promise.all(promises);
};
