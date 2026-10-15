# Wraps labtrail/index.html (the claude.ai artifact source) into a public page for Vercel.
import sys
src = sys.argv[1] if len(sys.argv) > 1 else '../labtrail/index.html'
h = open(src).read()
head = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Upload your lab reports and see every result in one private dashboard. Free.">
<meta property="og:title" content="Labtrail: your lab results in one place">
<meta property="og:description" content="Upload a lab report PDF or photo and get a clean dashboard with trends, scans and vaccines. Your data stays in your browser.">
<meta property="og:type" content="website">
<script>window.LABTRAIL_API='/api/extract';try{if(!sessionStorage.getItem('lt.hit')){sessionStorage.setItem('lt.hit','1');fetch('/api/hit',{method:'POST',keepalive:true})}}catch(e){}</script>
<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)}</script>
<script defer src="/_vercel/insights/script.js"></script>
'''
h = h.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
h = head + h
h = h.replace('</style>\n\n<div class="wrap">', '</style></head><body>\n<div class="wrap">', 1)
assert '<body>' in h
foot_old = 'Talk to a doctor about what your results mean for you.</p>'
assert foot_old in h
h = h.replace(foot_old, foot_old[:-4] + '''</p>
  <p class="foot"><strong>Privacy.</strong> When you add a report, the file is sent to Claude (Anthropic) to read the numbers. Labtrail does not store your files or results on its servers; results stay in this browser only, so back them up from the Reports tab. Labtrail counts anonymous totals such as visits and reports read. Inside the Instagram app, open the link in Safari or Chrome so your data is not lost when the in-app browser closes.</p>''', 1)
h += '\n</body></html>\n'
import os
os.makedirs('public', exist_ok=True)
open('public/index.html', 'w').write(h)
print('wrote public/index.html', len(h))
