"""Exercise the real IconMaker UI, IndexedDB persistence and decoded PNG/GIF downloads."""
from io import BytesIO
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from PIL import Image, ImageChops
import json
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / '.runtime'
SHOTS = RUNTIME / 'screenshots'
OUTPUT = RUNTIME / 'iconmaker-exports'
SHOTS.mkdir(exist_ok=True, parents=True)
OUTPUT.mkdir(exist_ok=True, parents=True)
URL = 'http://127.0.0.1:4173'
server = subprocess.Popen(['node', str(ROOT / 'server.mjs')], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
for _ in range(60):
    try:
        urllib.request.urlopen(URL + '/ctm-themes', timeout=1).close()
        break
    except Exception:
        if server.poll() is not None:
            raise RuntimeError(server.stdout.read().decode())
        time.sleep(.1)
else:
    server.terminate()
    raise RuntimeError('IconMaker fixture did not start')

network = []
errors = []

def offline(route):
    if route.request.url.startswith(URL):
        route.continue_()
    else:
        network.append(route.request.url)
        route.abort()


def change_color(locator, color):
    locator.evaluate("(element, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value); element.dispatchEvent(new Event('input', {bubbles:true})); element.dispatchEvent(new Event('change', {bubbles:true})); }", color)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    try:
        context = browser.new_context(viewport={'width': 1360, 'height': 1000}, reduced_motion='reduce')
        context.route('**/*', offline)
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        downloads = []
        page.on('download', lambda download: downloads.append(download))
        page.goto(URL + '/iconmaker', wait_until='networkidle')
        expect(page.get_by_role('heading', name='IconMaker', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='Baixar PNG', exact=True)).to_be_enabled()
        preview = page.get_by_label('Prévia do ícone', exact=True)
        page.get_by_role('button', name='Ver todos os corpos', exact=True).click()
        page.get_by_role('button', name='Ver todos os olhos', exact=True).click()
        for label in ['Gato', 'Alien', 'Fofinho', 'Coroa', 'Cartola', 'Headphones', 'Anjo', 'Diabinho', 'Invertido', 'Padrão']:
            page.get_by_role('radio', name='Corpo ' + label, exact=True).check()
            assert preview.locator('svg').count() == 1
        for label in ['Feliz', 'Piscando', 'Corações', 'Bravo', 'Estrelas', 'Retos', 'Fofos', 'Óculos de sol', 'Padrão']:
            page.get_by_role('radio', name='Olhos ' + label, exact=True).check()
        before = preview.inner_html()
        page.get_by_role('switch', name='Classic Mode', exact=True).check()
        assert preview.inner_html() != before
        page.get_by_role('switch', name='Classic Mode', exact=True).uncheck()
        page.get_by_role('button', name='Fundo #5865f2', exact=True).click()
        page.get_by_role('switch', name='Classic Mode', exact=True).check()
        change_color(page.get_by_label('Cor do corpo', exact=True), '#44cc88')
        page.wait_for_function("document.querySelector('.bf-im-stage').innerHTML.includes('#44cc88')")
        change_color(page.get_by_label('Cor do corpo', exact=True), '#ffffff')
        page.get_by_role('button', name='Configurar exportação', exact=True).click()
        page.get_by_label('Nome do arquivo', exact=True).fill('IconMaker teste')
        page.get_by_label('Recorte do fundo', exact=True).select_option('square')
        page.get_by_label('Tamanho PNG', exact=True).select_option('128')

        def download(button, filename):
            with page.expect_download() as event:
                page.get_by_role('button', name=button, exact=True).click()
            event.value.save_as(str(OUTPUT / filename))
            return OUTPUT / filename

        png = download('Baixar PNG', 'classic.png')
        classic = Image.open(png).convert('RGBA')
        assert classic.size == (128, 128)
        assert classic.getpixel((0, 0)) == (88, 101, 242, 255)
        page.get_by_role('switch', name='Classic Mode', exact=True).uncheck()
        modern = Image.open(download('Baixar PNG', 'modern.png')).convert('RGBA')
        assert ImageChops.difference(classic.convert('RGB'), modern.convert('RGB')).getbbox()
        svg = download('Baixar SVG', 'icon.svg').read_text()
        assert '<svg ' in svg and 'width="128"' in svg and '<script' not in svg
        page.get_by_role('switch', name='Classic Mode', exact=True).check()
        page.get_by_label('Tipo de fundo', exact=True).select_option('transparent')
        transparent = Image.open(download('Baixar PNG', 'transparent.png')).convert('RGBA')
        assert transparent.getpixel((0, 0))[3] == 0
        assert transparent.getpixel((64, 64))[3] == 255
        page.get_by_label('Tipo de fundo', exact=True).select_option('gradient')
        gradient = Image.open(download('Baixar PNG', 'gradient.png')).convert('RGBA')
        assert gradient.getpixel((0, 0)) != gradient.getpixel((127, 127))
        page.get_by_label('Tipo de fundo', exact=True).select_option('image')
        expect(page.get_by_role('button', name='Baixar PNG', exact=True)).to_be_disabled()
        fixture = BytesIO()
        Image.new('RGBA', (64, 64), (210, 40, 180, 255)).save(fixture, format='PNG')
        page.get_by_label('Imagem de fundo', exact=True).set_input_files({'name':'local.png','mimeType':'image/png','buffer':fixture.getvalue()})
        expect(page.get_by_role('button', name='Baixar PNG', exact=True)).to_be_enabled()
        photo = Image.open(download('Baixar PNG', 'background-image.png')).convert('RGBA')
        assert photo.getpixel((0, 0)) == (210, 40, 180, 255)
        page.get_by_label('Imagem do corpo', exact=True).set_input_files({'name':'local.png','mimeType':'image/png','buffer':fixture.getvalue()})
        expect(page.get_by_role('button', name='Remover imagem do corpo', exact=True)).to_be_visible()
        custom = Image.open(download('Baixar PNG', 'foreground-image.png')).convert('RGBA')
        assert custom.getpixel((64, 64)) == (210, 40, 180, 255)
        page.get_by_role('button', name='Remover imagem do corpo', exact=True).click()
        page.get_by_label('Imagem do corpo', exact=True).set_input_files({'name':'invalid.svg','mimeType':'image/svg+xml','buffer':b'<svg onload="alert(1)"/>'})
        expect(page.get_by_role('alert')).to_contain_text('PNG, JPG ou WebP')
        page.get_by_role('button', name='Novo projeto', exact=True).click()
        page.get_by_label('Tipo de fundo', exact=True).select_option('transparent')
        page.get_by_role('button', name='Animado', exact=True).click()
        page.get_by_role('radio', name='Movimento Flutuar', exact=True).check()
        expect(page.get_by_role('button', name='Reproduzir', exact=True)).to_be_visible()
        page.get_by_role('button', name='Reproduzir', exact=True).click()
        frame0 = preview.inner_html()
        page.wait_for_function("(old) => document.querySelector('.bf-im-stage').innerHTML !== old", arg=frame0)
        page.get_by_role('button', name='Pausar', exact=True).click()
        for label in ['Pular', 'Zoom elástico', 'Giro contínuo', 'Girar e parar', 'Dançar', 'Elástico', 'Dar a volta', 'Giro no eixo Y', 'Teletransporte', 'Escapar', 'Zoom e desaparecer', 'Flutuar']:
            page.get_by_role('radio', name='Movimento ' + label, exact=True).check()
            change_color(page.get_by_label('Quadro da prévia', exact=True), '0.23')
        for label in ['Brilho diagonal', 'Raios giratórios', 'Círculos expansivos', 'Céu estrelado', 'Chuva', 'Terra', 'Enchimento', 'Xadrez', 'Estrelas brilhantes', 'Notas musicais', 'Corações', 'Serra circular', 'Sem efeito']:
            page.get_by_role('radio', name='Efeito ' + label, exact=True).check()
            change_color(page.get_by_label('Quadro da prévia', exact=True), '0.4')
            image = Image.open(download('PNG deste quadro', 'effect-' + str(len(downloads)) + '.png')).convert('RGBA')
            assert image.size == (512, 512) and image.getbbox(), label
        page.get_by_role('radio', name='Movimento Flutuar', exact=True).check()
        page.get_by_label('Tamanho GIF', exact=True).select_option('128')
        page.get_by_label('Nome do arquivo', exact=True).fill('Animado teste')
        gif_path = download('Baixar GIF animado', 'animated.gif')
        gif = Image.open(gif_path)
        assert gif.size == (128, 128) and gif.n_frames == 60
        assert gif.info.get('loop') == 0
        gif.seek(0)
        first = gif.convert('RGBA')
        assert first.getpixel((0, 0))[3] == 0
        gif.seek(10)
        other = gif.convert('RGBA')
        assert ImageChops.difference(first.convert('RGB'), other.convert('RGB')).getbbox()
        assert gif.disposal_method == 2
        shared = download('Compartilhar projeto', 'shared.json')
        data = json.loads(shared.read_text())
        assert data['project']['schema'] == 2 and data['project']['duration'] == 3
        page.get_by_role('button', name='Novo projeto', exact=True).click()
        page.get_by_label('Arquivo do projeto', exact=True).set_input_files(str(shared))
        expect(page.get_by_role('radio', name='Movimento Flutuar', exact=True)).to_be_checked()
        page.get_by_role('switch', name='Modo escuro', exact=True).uncheck()
        expect(page.locator('.bf-im-site')).to_have_class('bf-im bf-im-site light')
        page.screenshot(path=str(SHOTS / 'iconmaker-light.png'), full_page=True)
        page.get_by_role('switch', name='Modo escuro', exact=True).check()
        page.get_by_role('switch', name='Classic Mode', exact=True).check()
        page.get_by_role('button', name='Salvar projeto', exact=True).click()
        expect(page.get_by_role('status').filter(has_text='Projeto salvo neste dispositivo.')).to_be_visible()
        page.reload(wait_until='networkidle')
        expect(page.get_by_role('button', name='Baixar GIF animado', exact=True)).to_be_enabled()
        expect(page.get_by_role('switch', name='Classic Mode', exact=True)).to_be_checked()
        page.get_by_role('button', name='Configurar exportação', exact=True).click()
        assert page.get_by_label('Nome do arquivo', exact=True).input_value() == 'Animado teste'
        assert page.get_by_label('Tamanho GIF', exact=True).input_value() == '128'
        page.get_by_label('Tamanho GIF', exact=True).select_option('512')
        change_color(page.get_by_label('Velocidade', exact=True), '1')
        page.get_by_label('Fluidez', exact=True).select_option('24')
        before_downloads = len(downloads)
        page.get_by_role('button', name='Baixar GIF animado', exact=True).click()
        page.get_by_role('button', name='Cancelar exportação', exact=True).click()
        expect(page.get_by_role('status').filter(has_text='Exportação cancelada.')).to_be_visible()
        assert len(downloads) == before_downloads
        page.screenshot(path=str(SHOTS / 'iconmaker-animated.png'), full_page=True)
        page.get_by_role('button', name='Estático', exact=False).first.click()
        page.set_viewport_size({'width': 780, 'height': 1000})
        assert page.locator('body').evaluate('e => e.scrollWidth <= window.innerWidth')
        page.get_by_role('button', name='Configurar exportação', exact=True).click()
        page.screenshot(path=str(SHOTS / 'iconmaker-static-narrow.png'), full_page=True)
        page.set_viewport_size({'width': 1360, 'height': 1000})
        page.screenshot(path=str(SHOTS / 'iconmaker-static.png'), full_page=True)
        assert not network, network
        assert not errors, errors
        print('PASS IconMaker browser: all bodies/eyes, Classic Mode, PNG/SVG/GIF decoded exports, live motion, transparent frames/disposal/loop, local images, unsupported-image rejection, export cancellation, real IndexedDB restoration, responsive layout and offline operation.', flush=True)
    except Exception:
        if browser.is_connected():
            try:
                page.screenshot(path=str(SHOTS / 'iconmaker-failure.png'), full_page=True)
            except Exception:
                pass
        raise
    finally:
        browser.close()
        server.terminate()
        server.wait(timeout=10)
