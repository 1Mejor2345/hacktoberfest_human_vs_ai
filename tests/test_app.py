"""Verify the Render entrypoint, asset integration and media playback contract."""
import hashlib
import re
import unittest

from app import app, MATERIALS


class PresentationAppTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_home_uses_current_presenter_flow_and_all_linked_assets_exist(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        html = response.get_data(as_text=True)
        self.assertIn('Tres turnos por ronda', html)
        self.assertNotIn('scores-open', html)
        self.assertNotIn('team-names', html)
        self.assertNotIn('setup-form', html)
        self.assertIn('type="module"', html)
        for url in re.findall(r'(?:href|src)="(/static/[^\"]+)"', html):
            with self.subTest(url=url):
                with self.client.get(url) as asset:
                    self.assertEqual(asset.status_code, 200)
        flow = self.client.get('/static/flow.js')
        self.assertEqual(flow.status_code, 200)
        self.assertIn('javascript', flow.content_type)
        flow.close()

    def test_inventory_has_100_unique_playable_original_materials(self):
        response = self.client.get('/materials.json')
        self.assertEqual(response.status_code, 200)
        materials = response.get_json()
        self.assertEqual(len(materials), 100)
        self.assertEqual(len({m['asset'] for m in materials}), 100)
        self.assertEqual({m['tipo'] for m in materials}, {'image', 'video', 'audio'})
        for material in materials:
            with self.subTest(asset=material['asset']):
                key = material['asset'].rsplit('/', 1)[1]
                record = MATERIALS[key]
                self.assertEqual(hashlib.sha256(record['path'].read_bytes()).hexdigest(), material['sha256'])
                response = self.client.get(material['asset'], headers={'Range': 'bytes=0-31'})
                self.assertEqual(response.status_code, 206)
                self.assertEqual(len(response.data), 32)
                self.assertTrue(response.content_type.startswith({'image': 'image/', 'video': 'video/', 'audio': 'audio/'}[material['tipo']]))
                self.assertNotIn('Set-Cookie', response.headers)
                response.close()

    def test_health_and_unknown_media(self):
        health = self.client.get('/health')
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.get_json()['materials'], 100)
        self.assertEqual(self.client.get('/media/not-a-material').status_code, 404)
        self.assertEqual(self.client.post('/api/answer', json={'choice': 'real'}).status_code, 404)


if __name__ == '__main__':
    unittest.main()
