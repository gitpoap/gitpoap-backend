# Search V2

## Introduction

This document details how we will approach the creation of multi-entity search - search that returns representations of records from multiple distinct tables (Repo, Organization, Profile, GitPOAP). A few options were evaluated for this feature.

1. Postgres ILIKE text search
2. Postgres full text search using `tsvector`
3. Search Engine such as Elasticsearch

After researching these options, it was concluded that Postgres ILIKE text search is likely the best option due to the following reasons: low complexity & time to ship. Given the low usage of search currently & the relatively small number of records that we're searching over, a simple search powered by Postgres ILIKE should work fine for us here. If we need to scale up or do more complex things, we should likely evaluate options such as Elasticsearch.

## Requirements

The requirements for the search V2 feature are as follows:

1. The endpoint should search over multiple record types - Repo, Organization, Profile, & GitPOAP.
2. The endpoint should return a standardized object for each search result.
3. The endpoint should be reasonably performant & should cache results
4. The results should be sorted by relevance
5. The endpoint should support pagination & filtering by entity type.

## Engineering Plan

We will create an endpoint that performs a single DB query over multiple tables using the SQL `UNION` operator & subsequently sort the results by levenshtein distance for the matched text & the search query. To implement pagination, we will introduce the use of `OFFSET` & `LIMIT`. The query will look something like the following:

````sql
with raw_records as (
  SELECT
    "Organization"."id",
    "Organization"."name" AS text,
    CONCAT('/gh/', "Organization"."name") AS href,
    'org' AS type,
    levenshtein("Organization"."name", ${matchText}) AS levenshtein
    FROM "Organization"
      WHERE "Organization"."name" ILIKE ${matchText}
    UNION
  SELECT
    "Repo"."id",
    "Repo"."name" AS text,
    CONCAT('/gh/', "Organization"."name", '/', "Repo"."name") AS href,
    'repo' AS type,
    levenshtein("Repo"."name", ${matchText}) AS levenshtein
    FROM "Repo" JOIN "Organization" ON "Repo"."organizationId" = "Organization"."id"
      WHERE "Repo"."name" ILIKE ${matchText}
    UNION
  SELECT
    "Profile"."id",
    "Profile"."address" AS text,
    CONCAT('/p/', "Profile"."address") AS href,
    'profile' AS type,
    levenshtein("Profile"."address", ${matchText}) AS levenshtein
    FROM "Profile"
      WHERE "address" ILIKE ${matchText}

)
SELECT *
  FROM raw_records
  ORDER BY levenshtein ASC
  LIMIT ${limit}
  OFFSET ${offset}
    ```
````

A search result will look something like the following:

```typescript
type SearchResult = {
  id: string; // ID of the record in its respective table
  text: string; // Text to display in the search result
  type: 'org' | 'profile' | 'repo' | 'gitpoap'; // Record type
  href: string; // URL to access the record's respective gitpoap.io page
  score: string; // relevance score ~ levenshtein distance
};
```

### Frontend Considerations

A search results page will display paginated results. From the basic information returned, the page can run entity specific queries to fetch further information. For example, if we wished to fetch further data on a specific repo (i.e. id: 1) such as associated gitpoaps, we can run a query as follows on the frontend:

```gql
query {
  repo(where: { id: 1 }) {
    id
    name
    _count {
      gitPOAPs
    }
    gitPOAPs {
      id
      year
      status
      poapEventId
      name
    }
  }
}
```

This would return something like the following:

```json
{
  "data": {
    "repo": {
      "id": 1,
      "name": "wagyu-installer",
      "_count": {
        "gitPOAPs": 2
      },
      "gitPOAPs": [
        {
          "id": 22,
          "year": 2021,
          "status": "APPROVED",
          "poapEventId": 37602
        },
        {
          "id": 1,
          "year": 2022,
          "status": "APPROVED",
          "poapEventId": 37428
        }
      ]
    }
  }
}
```
