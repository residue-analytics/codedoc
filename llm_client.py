from gradio_client import Client

client = Client("huggingface-projects/llama-2-7b-chat")

client.view_api()

#print(client.predict("Hi", 0.1, 256, 0.9, 1, fn_index=1))
