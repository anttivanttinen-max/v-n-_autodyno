import importlib.util, struct
from pathlib import Path
P=Path(__file__).parents[1]/"windows"/"rpm_bt_logger.py"
S=importlib.util.spec_from_file_location("logger",P); M=importlib.util.module_from_spec(S); S.loader.exec_module(M)
def test_decode_v1():
    b=struct.pack(M.FORMAT,1,2,42,1234,6000.0,6100.0,1.0,93,0,10,400,2,1,0,0)
    d=M.decode(b); assert d["sequence"]==42 and d["signalValid"] and not d["engineOff"] and d["rpm"]==6000.0
def test_reject_bad_length():
    try: M.decode(b"bad")
    except ValueError: return
    assert False


