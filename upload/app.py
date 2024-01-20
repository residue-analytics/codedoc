from flask import Flask, request, render_template

app = Flask(__name__)

@app.route('/')
def index():
  return render_template('upload.html')

@app.route('/upload', methods=['POST'])
def upload_file():
  if 'file' not in request.files:
    return 'No file part'
  file = request.files['file']
  if file.filename == '':
    return 'No selected file'
  if file:
    file.save(file.filename)
    return f'File {file.filename} uploaded successfully'

if __name__ == '__main__':
  app.run(debug=True, host='0.0.0.0', port=8000)
