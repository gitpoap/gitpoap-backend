# Cache Setup

We group single data via a prefix, so we have redis lookup keys like `prefix:key`, where the `key` is some sort of
identifier for the individual datapoint. This allows us to clear out all data for a particular class of cached data
via the `deletePrefix` function provided in our client wrapper.

## POAP API

| Request Type | Prefix             | Key      | TTL      | Notes                                                             |
| ------------ | ------------------ | -------- | -------- | ----------------------------------------------------------------- |
| Event Info   | `poap#event`       | Event ID | Forever  | We assume the event info doesn't change                           |
| POAP Info    | `poap#token`       | Token ID | Forever  | We assume the POAP info doesn't change (e.g. it's not transfered) |
| User's POAPs | `poap#user-tokens` | Address  | 1 minute | We keep this short since we don't control all miniting            |

## ENS

| Request Type | Prefix        | Key      | TTL     | Notes                                                    |
| ------------ | ------------- | -------- | ------- | -------------------------------------------------------- |
| Resolve ENS  | `ens#resolve` | ENS Name | Forever | We assume (for now) that ENS resolutions will not change |
