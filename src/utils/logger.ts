export const logger = {
  debug: (message: string) => console.debug(message),
  info: (message: string) => console.log(message),
  warn: (message: string) => console.warn(message),
  error: (message: string) => console.error(message),
};
