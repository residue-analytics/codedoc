from langchain.schema import SystemMessage, HumanMessage
from langchain.prompts import ChatPromptTemplate
from langchain.schema.runnable import RunnableMap
from langserve import RemoteRunnable
import asyncio
import logging

logging.getLogger().setLevel(logging.DEBUG)

async def  main():
    spaces_chain = RemoteRunnable("http://localhost:8000/spaces_chain/")

    prompt = [
        SystemMessage(content='Act like either a cat or a parrot.'),
        HumanMessage(content='Hello!')
    ]

    result = await spaces_chain.ainvoke({"text": "What do you know about the world wars?"})
    print(result)

    # Supports astream
#    async for msg in spaces_chain.astream(prompt):
#        print(msg, end="", flush=True)

    prompt = ChatPromptTemplate.from_messages(
        [("system", "Tell me a long story about {topic}")]
    )

    # Can define custom chains
    chain = prompt | RunnableMap({
        "spaces_chain": spaces_chain,
    })

    chain.batch([{ "topic": "parrots" }, { "topic": "cats" }])

asyncio.run(main())
