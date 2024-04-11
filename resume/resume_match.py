#!/usr/bin/env python

import sys
import logging
from pathlib import Path
#from llama_index.llms import Gemini
from base import ResumeScreenerPack

logging.basicConfig(stream=sys.stdout, level=logging.ERROR)
logging.getLogger().addHandler(logging.StreamHandler(stream=sys.stdout))

JD = """\
Data Engineer

Supports and enhances the Rogers Data Platform (RDP) built with Microsoft SQL Server, Azure Data Lake, Azure Synapse, and Synapse Data Pipelines. Collaborates with other engineers, developers, and users to ensure an optimal data architecture that is performant and scalable. Should have strong problem-solving skills and familiarity with programming languages to source, transform, and integrate data from different sources.

General Functions
-   Works with diverse business functions (Manufacturing, Sales, Service, Finance, Supply Chain, etc.) through service desk tickets and change requests.
-   Collaborates and communicates with stakeholders to understand issues and requirements.
-   Designs, codes, tests, and documents data solutions of medium complexity using Rogers’ tools and standards to achieve well-engineered results.
-   Monitors Rogers’ data environments and investigates problems in systems and services.
-   Conducts root cause analysis, and tracks error resolution through completion.
-   Understands and complies with relevant organizational policies and procedures (e.g., IT and SOx controls).
-   Applies and maintains security controls as required by organizational policy to maintain confidentiality, integrity, and availability of data.
"""

CR = [
"Must have 5+ years of experience",
"Bachelor’s degree or experience in Software Engineering, Computer Science, Software Development, or related field.",
"Experience in a data engineering or developer role working with multiple data sources, storage technologies, and data formats.",
"Experience using SQL and SQL Server Management Studio to store, manipulate, and retrieve data in relational databases.",
"Experience storing, manipulating, and retrieving structured and unstructured data using Azure Data Lake Storage, Azure Synapse and Azure Data Factory working with different data formats (Parquet, XML, JSON, CSV, etc.)",
"Good communication and collaboration skills.",
"Self-directed and comfortable supporting the data needs of multiple teams, systems, and products.",
"Experience with software development methodologies (e.g., SDLC, Agile, Scrum, etc.) following formal development practices and creating technical documentation."
]

screener = ResumeScreenerPack(job_description=JD, criteria=CR, gpt4=True)

#for path in Path("./data").glob("*.pdf"):
for response in screener.run("./data"):
    #print(response)

#    for cd in response.criteria_decisions:
#        print("### Criteria Decision")
#        print(cd.reasoning)
#        print(cd.decision)

#    print("Overall Reasoning")
    sel = None
    if response.overall_decision:
        sel = "Selected"
    else:
        sel = "Not-Selected"

    print(response.candidate_name + " : " + sel)
    print(str(response.overall_reasoning))
    print("\n")

