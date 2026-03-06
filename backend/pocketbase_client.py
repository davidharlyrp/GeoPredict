"""
PocketBase client module for soil_data collection.
Handles connection, data fetching (with pagination), and record creation.

Reads field definitions from params_config (derived from parameters.json).
"""

from pocketbase import PocketBase
from params_config import ALL_FIELDS

# PocketBase instance URL
PB_URL = "https://pb.daharin.com"

client = PocketBase(PB_URL)

COLLECTION_NAME = "soil_data"


def fetch_all_soil_data() -> list[dict]:
    """
    Fetch all records from the soil_data collection.
    Paginates through all pages to collect every record.
    Returns a list of dicts with only the configured fields.
    """
    records = []
    page = 1
    per_page = 200

    while True:
        result = client.collection(COLLECTION_NAME).get_list(
            page=page,
            per_page=per_page,
        )

        for item in result.items:
            record = {}
            for field in ALL_FIELDS:
                value = getattr(item, field, None)
                # Treat empty strings as None
                if value == "":
                    value = None
                record[field] = value
            records.append(record)

        if page >= result.total_pages:
            break
        page += 1

    return records


def create_soil_record(data: dict) -> dict:
    """
    Create a new record in the soil_data collection.
    Only includes non-None fields in the payload.
    Returns the created record as a dict.
    """
    payload = {}
    for field in ALL_FIELDS:
        if field in data and data[field] is not None:
            payload[field] = data[field]

    result = client.collection(COLLECTION_NAME).create(payload)

    return {
        "id": result.id,
        **{field: getattr(result, field, None) for field in ALL_FIELDS}
    }
