import copy
import unittest

from api_proxy import render, VARIABLE


class ApiProxyTests(unittest.TestCase):
    def setUp(self):
        self.ranges = ["173.245.48.0/20", "2400:cb00::/32"]
        self.api = {"match": [{"host": ["api.vozen.org"]}], "handle": [{
            "handler": "reverse_proxy", "upstreams": [{"dial": "127.0.0.1:3001"}],
            "headers": {"request": {"set": {"X-Existing": ["keep"]}}},
        }], "terminal": True}
        self.other = {"match": [{"host": ["other.invalid"]}], "handle": [{
            "handler": "static_response", "body": "unchanged", "status_code": 200,
        }]}
        self.config = {"apps": {"http": {"servers": {"srv0": {
            "listen": [":443"], "routes": [self.other, self.api],
        }}}}}

    def test_other_hosts_and_original_input_preserved(self):
        before = copy.deepcopy(self.config)
        result = render(self.config, self.ranges)
        self.assertEqual(self.config, before)
        self.assertEqual(result["apps"]["http"]["servers"]["srv0"]["routes"][0], self.other)
        self.assertNotIn("trusted_proxies", result["apps"]["http"]["servers"]["srv0"])

    def test_default_is_direct_peer_and_cf_match_is_network_scoped(self):
        handlers = render(self.config, self.ranges)["apps"]["http"]["servers"]["srv0"]["routes"][1]["handle"]
        self.assertEqual(handlers[0]["vozen_client_ip"], "{http.request.remote.host}")
        matcher = handlers[1]["routes"][0]["match"][0]
        self.assertEqual(matcher["remote_ip"]["ranges"], self.ranges)
        self.assertEqual(matcher["header"], {"Cf-Connecting-Ip": ["*"]})
        request = handlers[2]["headers"]["request"]
        for name in ("X-Forwarded-For", "X-Real-Ip", "Cf-Connecting-Ip"):
            self.assertEqual(request["set"][name], [VARIABLE])
        self.assertEqual(request["set"]["X-Existing"], ["keep"])
        self.assertIn("Forwarded", request["delete"])

    def test_render_is_idempotent(self):
        once = render(self.config, self.ranges)
        self.assertEqual(render(once, self.ranges), once)

    def test_nested_api_proxy_is_supported(self):
        self.api["handle"] = [{"handler": "subroute", "routes": [{"handle": self.api["handle"]}]}]
        result = render(self.config, self.ranges)
        nested = result["apps"]["http"]["servers"]["srv0"]["routes"][1]["handle"][2]
        self.assertIn("X-Forwarded-For", nested["routes"][0]["handle"][0]["headers"]["request"]["set"])

    def test_shared_host_route_is_rejected(self):
        self.api["match"][0]["host"].append("other.invalid")
        with self.assertRaises(ValueError):
            render(self.config, self.ranges)

    def test_empty_private_and_broad_trust_are_rejected(self):
        for ranges in ([], ["127.0.0.1/32"], ["0.0.0.0/0"], ["::/0"]):
            with self.subTest(ranges=ranges), self.assertRaises(ValueError):
                render(self.config, ranges)

    def test_missing_api_proxy_is_rejected(self):
        self.config["apps"]["http"]["servers"]["srv0"]["routes"] = [self.other]
        with self.assertRaises(ValueError):
            render(self.config, self.ranges)


if __name__ == "__main__":
    unittest.main()
