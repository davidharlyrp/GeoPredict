import os
import json
import params_config

print("--- DIAGNOSTIC START ---")
print(f"Config path in config.py: {os.path.abspath(params_config._CONFIG_PATH)}")
print(f"File exists: {os.path.exists(params_config._CONFIG_PATH)}")

print("\nKEYS IN MEMORY (from params_config.PARAMETER_LIST):")
for i, p in enumerate(params_config.PARAMETER_LIST):
    print(f"{i}: {p['key']}")

print("\nKEYS ON DISK (direct read):")
with open(params_config._CONFIG_PATH, 'r', encoding='utf-8') as f:
    try:
        data = json.load(f)
        for i, p in enumerate(data):
            print(f"{i}: {p['key']}")
    except Exception as e:
        print(f"JSON Load Error: {e}")
print("--- DIAGNOSTIC END ---")
