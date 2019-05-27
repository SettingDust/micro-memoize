// types
import { Cache, Memoized, Keys, Options, Values } from './types';

// utils
import {
  createGetKeyIndex,
  createUpdateAsyncCache,
  getCustomOptions,
  isFunction,
  isMemoized,
  isSameValueZero,
  mergeOptions,
  orderByLru,
} from './utils';

const { slice } = Array.prototype;
const { defineProperties } = Object;

function createMemoizedFunction<Fn extends Function>(
  fn: Fn,
  options: Options = {},
): Memoized<Fn> {
  if (isMemoized(fn)) {
    return fn;
  }

  if (!isFunction(fn)) {
    throw new TypeError('You must pass a function to `memoize`.');
  }

  const {
    isEqual = isSameValueZero,
    isMatchingKey,
    isPromise = false,
    maxSize = 1,
    onCacheAdd,
    onCacheChange,
    onCacheHit,
    transformKey,
  }: Options = options;

  const normalizedOptions = mergeOptions(getCustomOptions(options), {
    isEqual,
    isMatchingKey,
    isPromise,
    maxSize,
    onCacheAdd,
    onCacheChange,
    onCacheHit,
    transformKey,
  });

  const getKeyIndex = createGetKeyIndex(normalizedOptions);
  const updateAsyncCache = createUpdateAsyncCache(normalizedOptions);

  const keys: Keys = [];
  const values: Values = [];

  const cache: Cache = {
    keys,
    get size() {
      return cache.keys.length;
    },
    values,
  };

  const canTransformKey = typeof transformKey === 'function';

  const shouldCloneArguments = !!(transformKey || isMatchingKey);

  const shouldUpdateOnAdd = typeof onCacheAdd === 'function';
  const shouldUpdateOnChange = typeof onCacheChange === 'function';
  const shouldUpdateOnHit = typeof onCacheHit === 'function';

  // @ts-ignore
  const memoized: Memoized<Fn> = function memoized() {
    const normalizedArgs = shouldCloneArguments
      ? slice.call(arguments, 0)
      : arguments;
    const key = canTransformKey ? transformKey(normalizedArgs) : normalizedArgs;
    const keyIndex = keys.length ? getKeyIndex(keys, key) : -1;

    if (keyIndex !== -1) {
      shouldUpdateOnHit && onCacheHit(cache, normalizedOptions, memoized);

      if (keyIndex) {
        orderByLru(cache, keys[keyIndex], values[keyIndex], keyIndex, maxSize);

        shouldUpdateOnChange &&
          onCacheChange(cache, normalizedOptions, memoized);
      }
    } else {
      const newValue = fn.apply(this, arguments);
      const newKey = shouldCloneArguments ? key : slice.call(arguments, 0);

      orderByLru(cache, newKey, newValue, keys.length, maxSize);

      isPromise && updateAsyncCache(cache, memoized);

      shouldUpdateOnAdd && onCacheAdd(cache, normalizedOptions, memoized);
      shouldUpdateOnChange && onCacheChange(cache, normalizedOptions, memoized);
    }

    return values[0];
  };

  defineProperties(memoized, {
    cache: {
      configurable: true,
      value: cache,
    },
    cacheSnapshot: {
      configurable: true,
      get() {
        return {
          keys: slice.call(cache.keys, 0),
          size: cache.size,
          values: slice.call(cache.values, 0),
        };
      },
    },
    isMemoized: {
      configurable: true,
      value: true,
    },
    options: {
      configurable: true,
      value: normalizedOptions,
    },
  });

  return memoized;
}

export default createMemoizedFunction;
