<?php
/**
 * Plugin Name: Han Repair - Sistem Informasi Akuntansi Bengkel
 * Description: Menyajikan aplikasi Han Repair (bengkel motor) di WordPress dan menyimpan data barang, barang masuk, barang keluar, serta beban ke database WordPress melalui REST API.
 * Version: 1.0.0
 * Author: Han Repair
 * License: MIT
 *
 * CARA PAKAI SINGKAT
 * 1. Copy folder ini ke wp-content/plugins/han-repair/
 * 2. Copy seluruh file aplikasi (index.html, login.html, css/, js/, vendor/)
 *    ke dalam subfolder "app" di folder plugin ini, mis. wp-content/plugins/han-repair/app/
 * 3. Aktifkan plugin ini dari menu Plugins.
 * 4. Settings > Permalinks, pilih "Post name", klik Save (agar rewrite /han-repair/ aktif).
 * 5. Buka https://domain-anda.com/han-repair/
 */

if (!defined('ABSPATH')) {
    exit; // Akses langsung tidak diizinkan.
}

class Han_Repair_Plugin
{
    const NS = 'han-repair/v1';
    const QV = 'han_repair_route';

    /** Koleksi data yang disimpan. */
    private $collections = array('barang', 'masuk', 'keluar', 'beban');

    /** Lokasi folder aplikasi statis. */
    private $app_dir;

    public function __construct()
    {
        $this->app_dir = plugin_dir_path(__FILE__) . 'app/';

        add_action('init', array($this, 'add_rewrite'));
        add_filter('query_vars', array($this, 'query_vars'));
        add_action('template_redirect', array($this, 'serve_app'));
        add_action('rest_api_init', array($this, 'routes'));

        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, 'flush_rewrite_rules');
    }

    /* ---------------------------------------------------------------
     * Aktivasi/deaktivasi
     * ------------------------------------------------------------- */
    public function activate()
    {
        foreach ($this->collections as $c) {
            if (get_option('han_repair_' . $c, null) === null) {
                update_option('han_repair_' . $c, array(), false);
            }
        }
        $this->add_rewrite();
        flush_rewrite_rules();
    }

    /* ---------------------------------------------------------------
     * Rewrite: /han-repair/... -> file di folder app/
     * ------------------------------------------------------------- */
    public function add_rewrite()
    {
        add_rewrite_rule(
            '^han-repair/?$',
            'index.php?' . self::QV . '=index.html',
            'top'
        );
        add_rewrite_rule(
            '^han-repair/(.+)$',
            'index.php?' . self::QV . '=$matches[1]',
            'top'
        );
    }

    public function query_vars($vars)
    {
        $vars[] = self::QV;
        return $vars;
    }

    /* ---------------------------------------------------------------
     * Menyajikan file aplikasi
     * ------------------------------------------------------------- */
    public function serve_app()
    {
        $route = get_query_var(self::QV);
        if (empty($route)) {
            return;
        }

        $route = ltrim(wp_unslash($route), '/');
        if ($route === '') {
            $route = 'index.html';
        }

        // Cegah path traversal.
        if (strpos($route, '..') !== false || strpos($route, "\0") !== false) {
            status_header(400);
            exit;
        }

        $path = $this->app_dir . $route;
        $real = realpath($path);
        $base = realpath($this->app_dir);

        if ($real === false || $base === false || strpos($real, $base) !== 0 || !is_file($real)) {
            status_header(404);
            exit('File tidak ditemukan.');
        }

        // Aset statis (css/js/font) -> kirim apa adanya.
        if (strtolower(substr($route, -5)) !== '.html') {
            $this->stream_asset($real, $route);
            exit;
        }

        // Halaman HTML -> suntikkan konfigurasi REST + <base>.
        $html = file_get_contents($real);
        $base_url = home_url('/han-repair/');

        // Tambahkan <base> agar seluruh path relatif mengarah ke /han-repair/.
        $html = preg_replace('#<head(\s[^>]*)?>#i', '<head$1><base href="' . esc_url($base_url) . '">', $html, 1);

        $config = array(
            'api'   => esc_url_raw(rest_url(self::NS) . '/'),
            'nonce' => wp_create_nonce('wp_rest'),
            'data'  => $this->all_data(),
        );
        $script = '<script>window.HAN_REPAIR = ' . wp_json_encode($config) . ';</script>';
        $html = str_replace('</head>', $script . '</head>', $html);

        nocache_headers();
        header('Content-Type: text/html; charset=utf-8');
        echo $html;
        exit;
    }

    private function stream_asset($file, $route)
    {
        $ext = strtolower(pathinfo($route, PATHINFO_EXTENSION));
        $mimes = array(
            'css'   => 'text/css',
            'js'    => 'application/javascript',
            'svg'   => 'image/svg+xml',
            'png'   => 'image/png',
            'jpg'   => 'image/jpeg',
            'jpeg'  => 'image/jpeg',
            'gif'   => 'image/gif',
            'woff'  => 'font/woff',
            'woff2' => 'font/woff2',
            'ttf'   => 'font/ttf',
            'eot'   => 'application/vnd.ms-fontobject',
            'map'   => 'application/json',
        );
        $type = isset($mimes[$ext]) ? $mimes[$ext] : 'application/octet-stream';

        header('Content-Type: ' . $type);
        header('Content-Length: ' . filesize($file));
        header('Cache-Control: public, max-age=604800');
        readfile($file);
    }

    /* ---------------------------------------------------------------
     * REST API (CRUD ke database WordPress)
     * ------------------------------------------------------------- */
    public function routes()
    {
        register_rest_route(self::NS, '/(?P<collection>barang|masuk|keluar|beban)', array(
            array(
                'methods'             => 'GET',
                'callback'            => array($this, 'get_items'),
                'permission_callback' => '__return_true',
            ),
            array(
                'methods'             => 'POST',
                'callback'            => array($this, 'save_items'),
                'permission_callback' => array($this, 'can_write'),
            ),
        ));
    }

    /**
     * Izin menulis. Secara bawaan hanya admin yang login.
     * Untuk mengizinkan tanpa login (kurang aman), tambahkan di wp-config.php:
     *   define('HAN_REPAIR_OPEN_WRITE', true);
     */
    public function can_write()
    {
        if (defined('HAN_REPAIR_OPEN_WRITE') && HAN_REPAIR_OPEN_WRITE) {
            return true;
        }
        return current_user_can('manage_options');
    }

    public function get_items($request)
    {
        $c = $request['collection'];
        return rest_ensure_response(get_option('han_repair_' . $c, array()));
    }

    public function save_items($request)
    {
        $c = $request['collection'];
        $json = $request->get_json_params();
        $items = (is_array($json) && isset($json['items']) && is_array($json['items'])) ? $json['items'] : array();
        $items = $this->sanitize_items($items);

        update_option('han_repair_' . $c, $items, false);

        return rest_ensure_response(array('ok' => true, 'count' => count($items)));
    }

    private function sanitize_items($items)
    {
        $clean = array();
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $row = array();
            foreach ($item as $key => $value) {
                // PENTING: jangan pakai sanitize_key() karena ia mengubah huruf
                // menjadi kecil (hargaBeli -> hargabeli) sehingga field hilang.
                $key = preg_replace('/[^A-Za-z0-9_]/', '', (string) $key);
                if ($key === '') {
                    continue;
                }
                if (is_array($value)) {
                    $row[$key] = array_map('sanitize_text_field', $value);
                } elseif (is_numeric($value)) {
                    $row[$key] = $value + 0;
                } else {
                    $row[$key] = sanitize_text_field($value);
                }
            }
            $clean[] = $row;
        }
        return $clean;
    }

    /* ---------------------------------------------------------------
     * Helper
     * ------------------------------------------------------------- */
    private function all_data()
    {
        $data = array();
        foreach ($this->collections as $c) {
            $data[$c] = get_option('han_repair_' . $c, array());
        }
        return $data;
    }
}

new Han_Repair_Plugin();
