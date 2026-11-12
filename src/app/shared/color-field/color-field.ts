import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ColorInstance, InputColorModule } from 'primeng/inputcolor';
import { Popover } from 'primeng/popover';
import { TranslatePipe } from '../../core/i18n/i18n';

/** Colour field (PrimeNG 22 InputColor): a swatch that opens a picker with saturation area, hue slider and hex input. */
@Component({
  selector: 'app-color-field',
  imports: [TranslatePipe, FormsModule, InputColorModule, Popover],
  templateUrl: './color-field.html',
  styleUrl: './color-field.css',
})
export class ColorField {
  /** '#rrggbb' */
  readonly value = input.required<string>();
  readonly valueChange = output<string>();
  readonly label = input<string>();

  onChange(e: { color: ColorInstance }) {
    const hex = e.color.toString('hex').slice(0, 7).toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(hex) && hex !== this.value().toLowerCase()) this.valueChange.emit(hex);
  }
}
