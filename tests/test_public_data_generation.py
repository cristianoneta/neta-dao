import hashlib
import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
import check_public_data as public

NOW = 1795650000
GENERATION = 'generation-' + 'a'*64
MANIFEST = dict(schema_version=1, generation=GENERATION, source_revision='b'*40,
                published_at='2026-11-25T12:00:00Z', files={name:'c'*64 for name in public.NETA_SERVER_FILES})


class PublicGenerationTests(unittest.TestCase):
    def test_only_missing_manifest_uses_existing_static_site(self):
        for status in [404, 403, 429, 500]:
            def fetch(site, path, **kwargs):
                if site == public.NETA_SERVER: raise HTTPError('url',status,'status',{},None)
                return {'source':'legacy'},None
            read = public.neta_reader(NOW,fetch)
            if status == 404:
                self.assertEqual(read(public.NETA_SITE,'metadata.json')[0],{'source':'legacy'})
            else:
                with self.assertRaises(public.PrimarySourceError): read(public.NETA_SITE,'metadata.json')

    def test_fixed_generation_and_expected_hash_are_required_for_each_observation(self):
        calls=[]
        def fetch(site,path,**kwargs):
            calls.append((site,path,kwargs))
            return (MANIFEST,None) if path == 'current/manifest.json' else ({'source':'server'},None)
        read=public.neta_reader(NOW,fetch)
        self.assertEqual(read(public.NETA_SITE,'metadata.json')[0],{'source':'server'})
        self.assertEqual(calls[1],(public.NETA_SERVER,GENERATION+'/metadata.json',{'expected_sha':'c'*64}))
        def unavailable(site,path,**kwargs):
            if path == 'current/manifest.json': return MANIFEST,None
            raise HTTPError('url',404,'missing activated file',{},None)
        with self.assertRaises(HTTPError): public.neta_reader(NOW,unavailable)(public.NETA_SITE,'metadata.json')

    def test_invalid_manifest_and_timeout_do_not_mask_failure_with_legacy_data(self):
        for change in ({'generation':'../../other'},{'files':{}},{'source_revision':'unknown'},
                       {'published_at':'2099-01-01T00:00:00Z'}):
            read=public.neta_reader(NOW,lambda *a:({**MANIFEST,**change},None))
            with self.assertRaises(public.PrimarySourceError): read(public.NETA_SITE,'metadata.json')
        def timeout(*args): raise TimeoutError()
        with self.assertRaises(public.PrimarySourceError): public.neta_reader(NOW,timeout)(public.NETA_SITE,'metadata.json')

    def test_download_checks_original_bytes_before_json_and_never_follows_changed_hash(self):
        raw=b'{"generated_at":"2026-11-25T12:00:00Z"}'
        class Response(io.BytesIO):
            status=200
            headers={}
            def geturl(self): return public.NETA_SERVER + '/' + GENERATION + '/metadata.json'
        for digest,valid in [(hashlib.sha256(raw).hexdigest(),True),('0'*64,False)]:
            with patch.object(public.urllib.request,'urlopen',return_value=Response(raw)):
                if valid: self.assertEqual(public.download(public.NETA_SERVER,GENERATION+'/metadata.json',expected_sha=digest)[0],json.loads(raw))
                else:
                    with self.assertRaisesRegex(ValueError,'checksum'): public.download(public.NETA_SERVER,GENERATION+'/metadata.json',expected_sha=digest)


if __name__ == '__main__': unittest.main()
