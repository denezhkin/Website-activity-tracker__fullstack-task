export const validateEventObject = (obj: any): obj is EventObject => {
  return (
    typeof obj.event === 'string' &&
    Array.isArray(obj.tags) &&
    obj.tags.every((tag: any) => typeof tag === 'string') &&
    typeof obj.url === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.ts === 'number'
  );
};
