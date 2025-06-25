import subprocess
import pkg_resources

required = {
    "fastapi==0.110.0",
    "uvicorn==0.29.0",
    "python-dotenv==1.0.1",
    "openai==1.30.1",
    "chromadb==0.4.24",
    "pdfplumber==0.10.3",
    "python-docx==1.1.0",
    "python-pptx==0.6.23",
    "langchain==0.1.16",
    "jinja2==3.1.3",
}

installed = {f"{dist.key}=={dist.version}" for dist in pkg_resources.working_set}
to_install = [pkg for pkg in required if pkg.lower() not in installed]

if to_install:
    print("Installing missing packages:")
    subprocess.check_call(["pip", "install", *to_install])
else:
    print("All packages already installed.")
