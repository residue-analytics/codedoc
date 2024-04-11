#!/usr/bin/env python

from pathlib import Path
from typing import Any, Dict, List, Optional
from llama_index.core.llama_pack.base import BaseLlamaPack
from llama_index.core import SimpleDirectoryReader 
from llama_index.readers.file import PDFReader
from llama_index.llms.azure_openai import AzureOpenAI
from llama_index.embeddings.azure_openai import AzureOpenAIEmbedding
#from llama_index.llms import OpenAI
from llama_index.core import ServiceContext
from llama_index.core.schema import NodeWithScore
from llama_index.core.response_synthesizers import TreeSummarize

from pydantic import BaseModel, Field

# backwards compatibility
try:
    from llama_index.llms.llm import LLM
except ImportError:
    from llama_index.core.llms.base import BaseLLM

QUERY_TEMPLATE = """
You are an expert and strict resume reviewer who ensures all the screening criteria are strictly applied without any ambiguity.
Your job is to decide if the candidate passes the resume screen given the job description and a list of criteria. All the criterion must match for overall selection of a candidate:

### Job Description
{job_description}

### Screening Criteria
{criteria_str}
"""


class CriteriaDecision(BaseModel):
    """The decision made based on a single criteria"""

    decision: bool = Field(description="The decision made based on the criteria")
    reasoning: str = Field(description="The reasoning behind the decision")


class ResumeScreenerDecision(BaseModel):
    """The decision made by the resume screener"""

    criteria_decisions: List[CriteriaDecision] = Field(
        description="The decisions made based on the criteria"
    )
    candidate_name: str = Field(
        description="The name of the candidate as mentioned in the resume"
    )
    overall_reasoning: str = Field(
        description="The reasoning behind the overall decision"
    )
    overall_decision: bool = Field(
        description="The overall decision made based on the criteria"
    )


def _format_criteria_str(criteria: List[str]) -> str:
    criteria_str = ""
    for criterion in criteria:
        criteria_str += f"- {criterion}\n"
    return criteria_str


class ResumeScreenerPack(BaseLlamaPack):
    def __init__(
        self, job_description: str, criteria: List[str], gpt4: bool = False
    ) -> None:
        self.reader = PDFReader()
        if gpt4:
            llm = AzureOpenAI(
                model="gpt-4",
                deployment_name="gpt-4-turbo",
                api_key="",
                azure_endpoint="https://<endpt>.openai.azure.com/",
                api_version="2023-07-01-preview",
            )
        else:
            llm = AzureOpenAI(
                model="gpt-35-turbo-16k",
                deployment_name="gpt-35-turbo-16k",
                api_key="",
                azure_endpoint="https://<endpt>.openai.azure.com/",
                api_version="2023-07-01-preview",
            )

        embed_model = AzureOpenAIEmbedding(
            model="text-embedding-ada-002",
            deployment_name="text-embedding-ada-002",
            api_key="",
            azure_endpoint="https://<endpt>.openai.azure.com/",
            api_version="2023-07-01-preview",
        )

        llm = llm or OpenAI(model="gpt-4")
        service_context = ServiceContext.from_defaults(llm=llm, embed_model=embed_model)
        self.synthesizer = TreeSummarize(
            output_cls=ResumeScreenerDecision, service_context=service_context
        )
        criteria_str = _format_criteria_str(criteria)
        self.query = QUERY_TEMPLATE.format(
            job_description=job_description, criteria_str=criteria_str
        )

    def get_modules(self) -> Dict[str, Any]:
        """Get modules."""
        return {"reader": self.reader, "synthesizer": self.synthesizer}

    def run(self, resume_dir: str, *args: Any, **kwargs: Any) -> Any:
        """Run pack."""
        dir_reader = SimpleDirectoryReader(input_dir=resume_dir)
        for docs in dir_reader.iter_data():
            #docs = self.reader.load_data(Path(resume_path))
            output = self.synthesizer.synthesize(
                query=self.query,
                nodes=[NodeWithScore(node=doc, score=1.0) for doc in docs],
            )
            #print(docs[0].metadata["file_name"])
            yield output.response

