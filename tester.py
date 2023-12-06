from langchain.prompts  import PromptTemplate
from langchain.chains   import LLMChain
from langchain.globals  import set_llm_cache
from langchain.cache    import InMemoryCache
from HuggingFaceSpaces  import HuggingFaceSpaces
from langchain.llms     import OpenAI
from langchain.chat_models import ChatOpenAI
import os

#repo_id="codellama/codellama-playground",
#model_kwargs={'temperature':0.1, 'max_new_tokens':256,'topp_nucleus_sampling': 0.9,'repetition_penalty':1,'fn_index':1}

os.environ['HUGGINGFACEHUB_API_TOKEN'] = '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'

template = """Question: {question}

Answer: Let's think step by step."""
prompt = PromptTemplate(
        template=template,
    input_variables=['question']
)

# user question
#question = "Which NFL team won the Super Bowl in the 2010 season?"
question = "Hi. When was the first world war won"

# initialize Spaces LLM
spcs_llm = HuggingFaceSpaces(
        task="summarization",
        repo_id="huggingface-projects/llama-2-7b-chat",
        model_kwargs={'system_prompt':'You are a helpful agent', 'max_new_tokens':256,'temperature':0.1,'topp_nucleus_sampling': 0.9,'topk':40,'repetition_penalty':1,'api_name':'/chat'}
)

set_llm_cache(InMemoryCache())

# create prompt template > LLM chain
llm_chain = LLMChain(
    prompt=prompt,
    llm=spcs_llm
)

# ask the user question about NFL 2010
print(llm_chain.run(question))
