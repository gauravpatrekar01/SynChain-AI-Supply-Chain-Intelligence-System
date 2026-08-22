import os
from dotenv import load_dotenv
from neo4j import GraphDatabase

load_dotenv()

URI = os.getenv("NEO4J_URI")
USERNAME = os.getenv("NEO4J_USERNAME")
PASSWORD = os.getenv("NEO4J_PASSWORD")
DATABASE = os.getenv("NEO4J_DATABASE")

print("URI:", URI)
print("Username:", USERNAME)
print("Database:", DATABASE)

try:
    with GraphDatabase.driver(
        URI,
        auth=(USERNAME, PASSWORD)
    ) as driver:

        driver.verify_connectivity()

        print("Neo4j connection successful!")

except Exception as e:
    print("Neo4j connection failed!")
    print("Error:", e)