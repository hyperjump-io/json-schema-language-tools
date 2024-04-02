export const toAbsoluteUri = (uri) => {
  const position = uri.indexOf("#");
  return position === -1 ? uri : uri.slice(0, position);
};

export const uriFragment = (uri) => {
  const position = uri.indexOf("#");
  return position === -1 ? "" : uri.slice(position + 1);
};
