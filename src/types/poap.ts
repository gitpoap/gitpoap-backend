import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class POAPEvent {
  @Field()
  id: Number;

  @Field()
  fancy_id: string;

  @Field()
  name: string;

  @Field()
  event_url: string;

  @Field()
  image_url: string;

  @Field()
  country: string;

  @Field()
  city: string;

  @Field()
  description: string;

  @Field()
  year: number;

  @Field()
  start_date: string;

  @Field()
  end_date: string;

  @Field()
  expiry_date: string;

  @Field()
  supply: Number;
}

@ObjectType()
export class POAPToken {
  @Field(() => POAPEvent)
  event: POAPEvent;

  @Field()
  tokenId: string;

  @Field()
  owner: string;

  @Field()
  chain: string;

  @Field()
  created: string;
}
