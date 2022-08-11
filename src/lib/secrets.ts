import short from 'short-uuid';

// Create a secret code of the form "[0-9]{6}" that will be used to
// modify the event and allow minting of POAPs
export function generatePOAPSecret(): string {
  return short('0123456789').new().slice(0, 6);
}
