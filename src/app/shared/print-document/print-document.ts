import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Button } from 'primeng/button';
import { MoneyPipe } from '../../core/currency';
import { TranslatePipe } from '../../core/i18n/i18n';
import { GymTheme } from '../../core/models';
import { GymLogo } from '../gym-logo/gym-logo';

export interface PrintableDoc {
  kind: 'RECEIPT' | 'INVOICE';
  number: string;
  date: string;
  seller: { name: string; theme: GymTheme; lines: string[] };
  buyer: { name: string; lines: string[] };
  items: { label: string; detail?: string; amount: number }[];
  currency: string;
  /** VAT rate in % (amounts include VAT). */
  vatRate: number;
  paidWith?: string;
  note?: string;
}

/** A receipt / invoice laid out for A4 printing ("Save as PDF" in the print dialog). */
@Component({
  selector: 'app-print-document',
  imports: [TranslatePipe, DatePipe, MoneyPipe, RouterLink, FaIconComponent, Button, GymLogo],
  templateUrl: './print-document.html',
  styleUrl: './print-document.css',
})
export class PrintDocument {
  readonly doc = input.required<PrintableDoc>();
  readonly back = input<string>('/');
  total() { return this.doc().items.reduce((s, i) => s + i.amount, 0); }
  net() { return Math.round((this.total() / (1 + this.doc().vatRate / 100)) * 100) / 100; }
  vat() { return Math.round((this.total() - this.net()) * 100) / 100; }
  print() { window.print(); }
}
