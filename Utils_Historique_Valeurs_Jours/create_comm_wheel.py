import zipfile
import os

# Create a minimal comm wheel file
wheel_path = "jupyter-build/pypi/comm-0.1.0-py3-none-any.whl"

# Remove old file if exists
if os.path.exists(wheel_path):
    os.remove(wheel_path)

# Create minimal wheel structure
with zipfile.ZipFile(wheel_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    # Add minimal comm/__init__.py
    zf.writestr('comm/__init__.py', '"""Stub comm package for JupyterLite"""\n__version__ = "0.1.0"\n')
    
    # Add METADATA
    metadata = '''Metadata-Version: 2.1
Name: comm
Version: 0.1.0
Summary: Stub package for JupyterLite
Home-page: https://github.com/arthurpanck/jupyter
Author: Stub
Author-email: stub@example.com
License: BSD
Requires-Python: >=3.6
'''
    zf.writestr('comm-0.1.0.dist-info/METADATA', metadata)
    
    # Add WHEEL
    wheel_metadata = '''Wheel-Version: 1.0
Generator: jupyterlite-widget
Root-Is-Purelib: true
Tag: py3-none-any
'''
    zf.writestr('comm-0.1.0.dist-info/WHEEL', wheel_metadata)
    
    # Add RECORD (empty for now)
    zf.writestr('comm-0.1.0.dist-info/RECORD', '')

print(f"Created wheel file: {wheel_path}")
print(f"File size: {os.path.getsize(wheel_path)} bytes")
