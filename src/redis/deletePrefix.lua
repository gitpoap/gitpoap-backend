-- See: https://stackoverflow.com/questions/4006324/how-to-atomically-delete-keys-matching-a-pattern-using-redis/16974060#comment39607023_16974060
local keys = redis.call('keys', ARGV[1])
  for i=1,#keys,5000 do
    -- Switched to unlink since del is blocking
    redis.call('unlink', unpack(keys, i, math.min(i+4999, #keys)))
  end
return keys
