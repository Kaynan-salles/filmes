import urllib.request
import json
import re

def resolve_blogger(token):
    try:
        url = f'https://www.blogger.com/video.g?token={token}'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        html = urllib.request.urlopen(req, timeout=5).read().decode('utf-8', errors='ignore')
        
        m_fsid = re.search(r'"FdrFJe"\s*:\s*"(-?\d+)"', html)
        if not m_fsid:
            return None, 'No fsid'
            
        fsid = m_fsid.group(1)
        post_url = f'https://www.blogger.com/_/BloggerVideoPlayerUi/data/batchexecute?rpcids=WcwnYd&source-path=%2Fvideo.g&f.sid={fsid}'
        post_data = f'f.req={urllib.parse.quote(json.dumps([[["WcwnYd", json.dumps([token, None, 0]), None, "generic"]]]))}'.encode('utf-8')
        
        post_req = urllib.request.Request(post_url, data=post_data, headers={
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'User-Agent': 'Mozilla/5.0',
            'Referer': url
        })
        res_body = urllib.request.urlopen(post_req, timeout=5).read().decode('utf-8', errors='ignore')
        
        urls = re.findall(r'https?:\\/\\/[^\s"\'\\]+googlevideo\.com\\/videoplayback[^\s"\'\\]*', res_body)
        if urls:
            clean = urls[0].replace(r'\/', '/')
            return clean, 'OK'
        return None, 'No videoplayback'
    except Exception as e:
        return None, str(e)

# Test with token from zombie sagashitemasu
sample_token = 'AD6v5dx51SsHr2-uxY9rA0U79YHcT8dZWg-vdk9eTTzWe9IMxm3vScv7c4-Un9jW7rD1yqZR2vywrmezq8ixy4JKM3pphfrie7mvZQpDd6fBBu31tKxVQot9_N3woe8mtYbmv0TsNrI'
stream_url, status = resolve_blogger(sample_token)
print('Resolve result:', status)
if stream_url:
    print('Stream URL:', stream_url[:100])

