<?php

namespace Tests\Feature;

use Tests\TestCase;

class InterfaceRenderingTest extends TestCase
{
    public function test_login_route_serves_react_shell_and_assets(): void
    {
        $response = $this->get('/login');

        $response->assertStatus(200);

        $html = (string) $response->getContent();

        $this->assertStringContainsString('id="app"', $html);
        $this->assertStringContainsString('type="module"', $html);

        $this->assertMatchesRegularExpression(
            '/(resources\\/js\\/app\\.jsx|\\/build\\/assets\\/app-[^"\\s]+\\.js)/',
            $html
        );

        $this->assertMatchesRegularExpression(
            '/(resources\\/css\\/app\\.css|\\/build\\/assets\\/app-[^"\\s]+\\.css)/',
            $html
        );
    }
}
