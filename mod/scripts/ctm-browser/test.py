"""Browser integration tests against the actual CTM editor and filesystem adapter."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json
import re
import shutil
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / '.runtime'
SCREENSHOTS = RUNTIME / 'screenshots'
SCREENSHOTS.mkdir(parents=True, exist_ok=True)
PACKS = ['Apple', 'BlobMoji', 'Facebook', 'Google', 'Huawei', 'JoyPixels', 'Microsoft', 'Microsoft-3D', 'OpenMoji', 'Samsung', 'Samsung-Old', 'Toss', 'WhatsApp']
EMOJIS = ['grinning', 'joy', 'heart_eyes', 'sunglasses']
BASE = 'https://mwittrien.github.io/BetterDiscordAddons/Themes/EmojiReplace/'
RADIAL = 'https://discordstyles.github.io/RadialStatus/RadialStatus.css'
CACHE = {}
URL = 'http://127.0.0.1:4173'


def fetch_asset(url):
    with urllib.request.urlopen(url, timeout=35) as response:
        return url, response.read(1000000)


urls = [RADIAL] + [BASE + 'base/' + pack + '.css' for pack in PACKS] + [BASE + 'emojis/' + pack + '/people/' + emoji + '.png' for pack in PACKS for emoji in EMOJIS]
for url, data in ThreadPoolExecutor(max_workers=6).map(fetch_asset, urls):
    CACHE[url] = data
print('Verified remote resources:', len(CACHE), flush=True)


def start_server():
    process = subprocess.Popen(['node', str(ROOT / 'server.mjs')], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for attempt in range(60):
        try:
            with urllib.request.urlopen(URL + '/ctm-themes', timeout=1):
                return process
        except Exception:
            if process.poll() is not None:
                raise RuntimeError(process.stdout.read().decode())
            time.sleep(.1)
    process.terminate()
    raise RuntimeError('Validation server did not start')


def api(path):
    with urllib.request.urlopen(URL + path, timeout=5) as response:
        return json.load(response)


server = start_server()
errors = []
failed_pack = {'value': ''}


def intercept(route):
    url = route.request.url
    if url.startswith('https://discord.com/assets/'):
        route.abort()
    elif url.startswith('https://fonts.googleapis.com/'):
        route.fulfill(status=503, body='font temporarily unavailable', content_type='text/css')
    elif url == RADIAL:
        route.fulfill(body=CACHE[url], content_type='text/css')
    elif url.startswith(BASE):
        if failed_pack['value'] and '/base/' + failed_pack['value'] + '.css' in url:
            route.fulfill(status=503, body='unavailable', headers={'Access-Control-Allow-Origin': '*'})
        elif '/base/' in url:
            route.fulfill(body='/* The provider URL was checked above. Preview images use the same pack assets. */', content_type='text/css', headers={'Access-Control-Allow-Origin': '*'})
        elif url in CACHE:
            route.fulfill(body=CACHE[url], content_type='image/png')
        else:
            route.fulfill(status=404)
    elif url == 'https://images.example.test/background.svg':
        route.fulfill(body='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#354965"/></svg>', content_type='image/svg+xml')
    else:
        route.continue_()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    try:
        context = browser.new_context(viewport={'width': 1680, 'height': 1150}, device_scale_factor=1)
        context.route('**/*', intercept)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(URL, wait_until='networkidle')
        expect(page.get_by_role('heading', name='Criador de temas', exact=True)).to_be_visible()
        frame = page.frame_locator('iframe[title="Prévia isolada do tema"]')
        expect(frame.get_by_text('Seu espaço, seu estilo.')).to_be_visible()
        baseline = page.locator('html').evaluate("e => getComputedStyle(e).getPropertyValue('--brand-500')")
        screenshot = SCREENSHOTS / 'ctm-default.png'
        page.screenshot(path=str(screenshot), full_page=True)
        assert page.locator('iframe').get_attribute('sandbox') == 'allow-same-origin'
        assert frame.locator('script').count() == 0
        for name, color in [('Discord', 'rgb(49, 51, 56)'), ('Meia-noite', 'rgb(19, 21, 28)'), ('Oceano', 'rgb(23, 42, 50)'), ('Claro', 'rgb(255, 255, 255)'), ('Grafite', 'rgb(36, 36, 41)')]:
            page.get_by_role('group', name='Paletas prontas').get_by_role('button', name=name, exact=True).click()
            expect(frame.locator('.chatContent_preview')).to_have_css('background-color', color)
        page.get_by_label('Fundo das mensagens', exact=True).fill('#121820')
        expect(frame.locator('.chatContent_preview')).to_have_css('background-color', 'rgb(18, 24, 32)')
        page.get_by_role('tab', name='Tipografia', exact=True).click()
        page.get_by_label('Fonte', exact=True).select_option('Inter')
        expect(page.get_by_text('A fonte Inter não carregou.', exact=False)).to_be_visible()
        page.get_by_label('Fonte', exact=True).select_option('Arial')
        expect(page.locator('.bf-ctm-warning')).to_have_count(0)
        page.get_by_label('Tamanho da fonte', exact=True).press('End')
        page.get_by_label('Altura da linha', exact=True).press('End')
        page.get_by_label('Peso da fonte', exact=True).select_option('500')
        expect(frame.locator('.ctm-message-text').first).to_have_css('font-size', '22px')
        expect(frame.locator('.ctm-message-text').first).to_have_css('line-height', '44px')
        expect(frame.locator('.ctm-message-text').first).to_have_css('font-weight', '500')
        page.get_by_role('button', name='Ampliar', exact=True).click()
        expect(page.get_by_role('dialog', name='Prévia do tema')).to_be_visible()
        page.keyboard.press('Escape')
        expect(page.get_by_role('dialog', name='Prévia do tema')).to_have_count(0)
        page.get_by_role('tab', name='Aparência', exact=True).click()
        page.get_by_label('Cor de destaque', exact=True).fill('#2bbd89')
        expect(frame.locator('html')).to_have_css('--byaflux-ctm-accent', '#2bbd89')
        assert page.locator('html').evaluate("e => getComputedStyle(e).getPropertyValue('--brand-500')") == baseline
        page.get_by_role('tab', name='Layout', exact=True).click()
        page.get_by_label('Largura dos canais', exact=True).press('End')
        page.get_by_label('Espaço entre mensagens', exact=True).press('End')
        page.get_by_label('Raio dos cartões', exact=True).press('End')
        expect(frame.locator('.sidebar_preview')).to_have_css('width', '360px')
        expect(frame.locator('.message').first).to_have_css('margin-top', '32px')
        expect(frame.locator('.composer')).to_have_css('border-radius', '24px')
        icon = frame.locator('.server .icon_preview').first
        for label, shape in [('Redondo', 'circle'), ('Triangular', 'polygon'), ('Quadrado', 'inset'), ('Quadrado arredondado', 'round 16px')]:
            page.get_by_role('radio', name=label, exact=True).check()
            expect(icon).to_have_css('clip-path', re.compile(shape))
            button = frame.locator('.server').first
            assert button.evaluate('e => e.clientWidth') == 48
            expect(frame.locator('.mentions')).to_have_text('3')
            expect(frame.locator('.pill')).to_be_visible()
        page.get_by_label('Raio dos ícones', exact=True).press('End')
        expect(icon).to_have_css('clip-path', re.compile('round 24px'))
        page.get_by_role('radio', name='Quadrado', exact=True).check()
        expect(page.get_by_label('Raio dos ícones', exact=True)).to_have_count(0)
        page.get_by_role('button', name=re.compile('Restaurar formato nativo')).click()
        expect(icon).to_have_css('clip-path', 'none')
        page.get_by_role('tab', name='Detalhes', exact=True).click()
        page.get_by_role('button', name='Radial', exact=True).click()
        online = frame.locator('.state .ctm-avatar > svg > rect').first
        expect(online).to_have_css('stroke', 'rgb(67, 181, 129)')
        expect(online).to_have_css('stroke-width', '2px')
        page.get_by_label('Espessura Membros', exact=True).fill('5')
        expect(online).to_have_css('stroke-width', '5px')
        page.get_by_label('Distância Membros', exact=True).fill('6')
        expect(frame.locator('.state .ctm-avatar img').first).to_have_css('clip-path', re.compile('7px'))
        page.get_by_role('button', name='Antes', exact=True).click()
        expect(icon).to_have_css('clip-path', 'none')
        expect(frame.locator('html')).to_have_css('--byaflux-ctm-accent', '#5865f2')
        page.get_by_role('button', name='Depois', exact=True).click()
        expect(online).to_have_css('stroke-width', '5px')
        for pack in PACKS:
            page.get_by_label('Emojis', exact=True).select_option(pack)
            images = frame.locator('.message').first.locator('.emoji')
            expect(images.first).to_have_attribute('src', re.compile('/emojis/' + re.escape(pack) + '/people/grinning.png'))
            for image in images.all():
                expect(image).to_be_visible()
                expect(image).to_have_js_property('complete', True)
                assert image.evaluate('e => e.naturalWidth > 0')
            expect(page.locator('.bf-ctm-warning')).to_have_count(0)
        failed_pack['value'] = 'Apple'
        page.get_by_label('Emojis', exact=True).select_option('Apple')
        expect(page.get_by_text('O pack Apple não carregou.', exact=False)).to_be_visible()
        expect(frame.locator('.message').first.locator('.emoji').first).to_have_attribute('src', re.compile('https://discord.com/assets/'))
        failed_pack['value'] = ''
        page.get_by_label('Emojis', exact=True).select_option('Discord')
        expect(page.locator('.bf-ctm-warning')).to_have_count(0)
        page.get_by_label('Emojis', exact=True).select_option('Apple')
        expect(frame.locator('.emoji').first).to_have_attribute('src', re.compile('/Apple/'))
        page.get_by_role('tab', name='Layout', exact=True).click()
        page.get_by_role('radio', name='Triangular', exact=True).check()
        page.get_by_role('switch', name='Barra lateral compacta', exact=True).check()
        expect(frame.locator('.sidebar_preview')).to_have_css('width', '240px')
        page.get_by_role('tab', name='Aparência', exact=True).click()
        page.get_by_role('switch', name='Fundo personalizado', exact=True).check()
        page.get_by_label('URL do fundo', exact=True).fill('https://images.example.test/background.svg')
        expect(frame.locator('#app-mount')).to_have_css('background-image', re.compile('background.svg'))
        assert page.locator('html').evaluate("e => getComputedStyle(e).getPropertyValue('--brand-500')") == baseline
        page.get_by_label('Nome do tema', exact=True).fill('CTM Playwright')
        page.get_by_role('button', name='Salvar e ativar', exact=True).click()
        expect(page.get_by_role('status').filter(has_text='Salvo e ativado: CTM Playwright.theme.css')).to_be_visible()
        # Verify the saved CSS really applies outside the editor, through imported local files.
        expect(page.locator('#client-proof')).to_have_css('background-color', 'rgb(18, 24, 32)')
        expect(page.locator('.messageContent_live')).to_have_css('font-size', '22px')
        expect(page.locator('.messageContent_live')).to_have_css('line-height', '44px')
        expect(page.locator('.messageContent_live')).to_have_css('font-weight', '500')
        state = api('/settings')
        assert state['enabledThemes'] == ['Other.theme.css', 'CTM Playwright.theme.css']
        assert state['themeActivationModes']['Other.theme.css'] == 'dark'
        assert any(t['name'] == 'CTM Playwright' for t in api('/themes'))
        page.get_by_role('button', name='Novo tema', exact=False).click()
        page.get_by_label('Nome do tema', exact=True).fill('CTM Playwright')
        page.get_by_role('button', name='Salvar e ativar', exact=True).click()
        expect(page.get_by_role('status').filter(has_text='CTM Playwright (2).theme.css')).to_be_visible()
        assert api('/settings')['enabledThemes'] == ['Other.theme.css', 'CTM Playwright (2).theme.css']
        browser.close()
        server.terminate()
        server.wait(timeout=10)
        server = start_server()
        browser = playwright.chromium.launch()
        context = browser.new_context(viewport={'width': 1680, 'height': 1150})
        context.route('**/*', intercept)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(URL, wait_until='networkidle')
        page.get_by_role('button', name=re.compile('Meus temas')).click()
        card = page.locator('.bf-ctm-theme-card').filter(has=page.get_by_text('CTM Playwright', exact=True))
        card.get_by_role('button', name='Editar', exact=True).click()
        assert page.get_by_label('Nome do tema', exact=True).input_value() == 'CTM Playwright'
        assert page.get_by_label('URL do fundo', exact=True).input_value() == 'https://images.example.test/background.svg'
        assert page.get_by_label('Fundo das mensagens', exact=True).input_value() == '#121820'
        page.get_by_role('tab', name='Tipografia', exact=True).click()
        assert page.get_by_label('Fonte', exact=True).input_value() == 'Arial'
        assert page.get_by_label('Tamanho da fonte', exact=True).input_value() == '22'
        assert page.get_by_label('Altura da linha', exact=True).input_value() == '2'
        assert page.get_by_label('Peso da fonte', exact=True).input_value() == '500'
        page.get_by_role('tab', name='Layout', exact=True).click()
        expect(page.get_by_role('radio', name='Triangular', exact=True)).to_be_checked()
        assert page.get_by_label('Raio dos cartões', exact=True).input_value() == '24'
        page.get_by_role('tab', name='Detalhes', exact=True).click()
        assert page.get_by_label('Emojis', exact=True).input_value() == 'Apple' 
        assert page.get_by_label('Espessura Membros', exact=True).input_value() == '5'
        assert page.get_by_label('Distância Membros', exact=True).input_value() == '6'
        page.get_by_label('Nome do tema', exact=True).fill('CTM Editado')
        page.get_by_role('button', name='Salvar e ativar', exact=True).click()
        expect(page.get_by_role('status').filter(has_text='Salvo e ativado: CTM Playwright.theme.css')).to_be_visible()
        assert len(api('/ctm-themes')) == 2
        assert api('/settings')['enabledThemes'] == ['Other.theme.css', 'CTM Playwright.theme.css']
        page.screenshot(path=str(SCREENSHOTS / 'ctm-restored-and-edited.png'), full_page=True)
        page.set_viewport_size({'width': 1120, 'height': 900})
        page.get_by_role('tab', name='Aparência', exact=True).click()
        expect(frame.get_by_text('Seu espaço, seu estilo.')).to_be_visible()
        assert page.locator('.bf-ctm-frame').evaluate('e => e.scrollWidth <= e.clientWidth + 1')
        assert page.locator('body').evaluate('e => e.scrollWidth <= window.innerWidth')
        page.screenshot(path=str(SCREENSHOTS / 'ctm-native-width.png'), full_page=True)
        assert not errors, errors
        print('PASS CTM browser: presets, typography, current Discord tokens, actual CSS activation, no iframe scripts, responsive preview, shapes, radius, radial measures, Before/After, 13 emoji packs, failed-pack fallback, isolation, real files, name collisions, restart, editing and activation.', flush=True)
    except Exception:
        if browser.is_connected():
            try:
                page.screenshot(path=str(SCREENSHOTS / 'failure.png'), full_page=True)
            except Exception:
                pass
        raise
    finally:
        if browser.is_connected():
            browser.close()
        server.terminate()
        server.wait(timeout=10)
