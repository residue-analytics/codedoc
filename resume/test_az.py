#!/usr/bin/env python

from llama_index.llms.azure_openai import AzureOpenAI
from llama_index.embeddings.azure_openai import AzureOpenAIEmbedding
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from llama_index.core import Settings
import logging
import sys

logging.basicConfig(
    stream=sys.stdout, level=logging.INFO
)  # logging.DEBUG for more verbose output
logging.getLogger().addHandler(logging.StreamHandler(stream=sys.stdout))

#    model="gpt-35-turbo-16k",
#    api_key="",
#    deployment_name="gpt-4-turbo",
#    model="gpt-4",
#    api_key="",
llm = AzureOpenAI(
    model="gpt-4",
    deployment_name="gpt-4-turbo",
    api_key="",
    azure_endpoint="https://<endpt>.openai.azure.com/",
    api_version="2023-07-01-preview",
)

# You need to deploy your own embedding model as well as your own chat completion model
embed_model = AzureOpenAIEmbedding(
    model="text-embedding-ada-002",
    deployment_name="text-embedding-ada-002",
    api_key="",
    azure_endpoint="https://<endpt>.openai.azure.com/",
    api_version="2023-07-01-preview",
)

Settings.llm = llm
Settings.embed_model = embed_model

documents = SimpleDirectoryReader(
    input_files=["essay.txt"]
).load_data()
index = VectorStoreIndex.from_documents(documents)

query = "What is most interesting about this essay?"
query_engine = index.as_query_engine()
answer = query_engine.query(query)

print(answer.get_formatted_sources())
print("query was:", query)
print("answer was:", answer)
