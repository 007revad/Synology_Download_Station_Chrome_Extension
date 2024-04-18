SYNO = window.SYNO || {};

(function(){
	"use-strict";
	SYNO.Encryption = {};
	SYNO.Encryption.Base64 = (function() {
		var b = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
		var a = "=";
		return {
			hex2b64: function(f) {
				var e;
				var g;
				var d = "";
				for (e = 0; e + 3 <= f.length; e += 3) {
					g = parseInt(f.substring(e, e + 3), 16);
					d += b.charAt(g >> 6) + b.charAt(g & 63)
				}
				if (e + 1 == f.length) {
					g = parseInt(f.substring(e, e + 1), 16);
					d += b.charAt(g << 2)
				} else {
					if (e + 2 == f.length) {
						g = parseInt(f.substring(e, e + 2), 16);
						d += b.charAt(g >> 2) + b.charAt((g & 3) << 4)
					}
				}
				while ((d.length & 3) > 0) {
					d += a
				}
				return d
			},
			b64tohex: function(g) {
				var e = "";
				var f;
				var c = 0;
				var d;
				for (f = 0; f < g.length; ++f) {
					if (g.charAt(f) == a) {
						break
					}
					v = b.indexOf(g.charAt(f));
					if (v < 0) {
						continue
					}
					if (c == 0) {
						e += int2char(v >> 2);
						d = v & 3;
						c = 1
					} else {
						if (c == 1) {
							e += int2char((d << 2) | (v >> 4));
							d = v & 15;
							c = 2
						} else {
							if (c == 2) {
								e += int2char(d);
								e += int2char(v >> 2);
								d = v & 3;
								c = 3
							} else {
								e += int2char((d << 2) | (v >> 4));
								e += int2char(v & 15);
								c = 0
							}
						}
					}
				}
				if (c == 1) {
					e += int2char(d << 2)
				}
				return e
			},
			b64toBA: function(f) {
				var e = b64tohex(f);
				var d;
				var c = new Array();
				for (d = 0; 2 * d < e.length; ++d) {
					c[d] = parseInt(e.substring(2 * d, 2 * d + 2), 16)
				}
				return c
			}
		}
	})();
	SYNO = window.SYNO || {};
	SYNO.Encryption = SYNO.Encryption || {};
	SYNO.Encryption.BigInteger = (function() {
		var H;
		var Z = 244837814094590;
		var f = ((Z & 16777215) == 15715070);
		function d(ab, aa, ac) {
			if (ab != null) {
				if ("number" == typeof ab) {
					this.fromNumber(ab, aa, ac)
				} else {
					if (aa == null && "string" != typeof ab) {
						this.fromString(ab, 256)
					} else {
						this.fromString(ab, aa)
					}
				}
			}
		}
		function l() {
			return new d(null)
		}
		function L(ae, aa, ab, ad, ag, af) {
			while (--af >= 0) {
				var ac = aa * this[ae++] + ab[ad] + ag;
				ag = Math.floor(ac / 67108864);
				ab[ad++] = ac & 67108863
			}
			return ag
		}
		function K(ae, aj, ak, ad, ah, aa) {
			var ag = aj & 32767,
				ai = aj >> 15;
			while (--aa >= 0) {
				var ac = this[ae] & 32767;
				var af = this[ae++] >> 15;
				var ab = ai * ac + af * ag;
				ac = ag * ac + ((ab & 32767) << 15) + ak[ad] + (ah & 1073741823);
				ah = (ac >>> 30) + (ab >>> 15) + ai * af + (ah >>> 30);
				ak[ad++] = ac & 1073741823
			}
			return ah
		}
		function J(ae, aj, ak, ad, ah, aa) {
			var ag = aj & 16383,
				ai = aj >> 14;
			while (--aa >= 0) {
				var ac = this[ae] & 16383;
				var af = this[ae++] >> 14;
				var ab = ai * ac + af * ag;
				ac = ag * ac + ((ab & 16383) << 14) + ak[ad] + ah;
				ah = (ac >> 28) + (ab >> 14) + ai * af;
				ak[ad++] = ac & 268435455
			}
			return ah
		}
		if (f && (navigator.appName == "Microsoft Internet Explorer")) {
			d.prototype.am = K;
			H = 30
		} else {
			if (f && (navigator.appName != "Netscape")) {
				d.prototype.am = L;
				H = 26
			} else {
				d.prototype.am = J;
				H = 28
			}
		}
		d.prototype.DB = H;
		d.prototype.DM = ((1 << H) - 1);
		d.prototype.DV = (1 << H);
		var m = 52;
		d.prototype.FV = Math.pow(2, m);
		d.prototype.F1 = m - H;
		d.prototype.F2 = 2 * H - m;
		var t = "0123456789abcdefghijklmnopqrstuvwxyz";
		var y = new Array();
		var E, o;
		E = "0".charCodeAt(0);
		for (o = 0; o <= 9; ++o) {
			y[E++] = o
		}
		E = "a".charCodeAt(0);
		for (o = 10; o < 36; ++o) {
			y[E++] = o
		}
		E = "A".charCodeAt(0);
		for (o = 10; o < 36; ++o) {
			y[E++] = o
		}
		function x(aa) {
			return t.charAt(aa)
		}
		function C(ab, aa) {
			var ac = y[ab.charCodeAt(aa)];
			return (ac == null) ? -1 : ac
		}
		function n(ab) {
			for (var aa = this.t - 1; aa >= 0; --aa) {
				ab[aa] = this[aa]
			}
			ab.t = this.t;
			ab.s = this.s
		}
		function R(aa) {
			this.t = 1;
			this.s = (aa < 0) ? -1 : 0;
			if (aa > 0) {
				this[0] = aa
			} else {
				if (aa < -1) {
					this[0] = aa + DV
				} else {
					this.t = 0
				}
			}
		}
		function b(aa) {
			var ab = l();
			ab.fromInt(aa);
			return ab
		}
		function M(ag, ab) {
			var ad;
			if (ab == 16) {
				ad = 4
			} else {
				if (ab == 8) {
					ad = 3
				} else {
					if (ab == 256) {
						ad = 8
					} else {
						if (ab == 2) {
							ad = 1
						} else {
							if (ab == 32) {
								ad = 5
							} else {
								if (ab == 4) {
									ad = 2
								} else {
									this.fromRadix(ag, ab);
									return
								}
							}
						}
					}
				}
			}
			this.t = 0;
			this.s = 0;
			var af = ag.length,
				ac = false,
				ae = 0;
			while (--af >= 0) {
				var aa = (ad == 8) ? ag[af] & 255 : C(ag, af);
				if (aa < 0) {
					if (ag.charAt(af) == "-") {
						ac = true
					}
					continue
				}
				ac = false;
				if (ae == 0) {
					this[this.t++] = aa
				} else {
					if (ae + ad > this.DB) {
						this[this.t - 1] |= (aa & ((1 << (this.DB - ae)) - 1)) << ae;
						this[this.t++] = (aa >> (this.DB - ae))
					} else {
						this[this.t - 1] |= aa << ae
					}
				}
				ae += ad;
				if (ae >= this.DB) {
					ae -= this.DB
				}
			}
			if (ad == 8 && (ag[0] & 128) != 0) {
				this.s = -1;
				if (ae > 0) {
					this[this.t - 1] |= ((1 << (this.DB - ae)) - 1) << ae
				}
			}
			this.clamp();
			if (ac) {
				d.ZERO.subTo(this, this)
			}
		}
		function P() {
			var aa = this.s & this.DM;
			while (this.t > 0 && this[this.t - 1] == aa) {
				--this.t
			}
		}
		function T(ab) {
			if (this.s < 0) {
				return "-" + this.negate().toString(ab)
			}
			var ac;
			if (ab == 16) {
				ac = 4
			} else {
				if (ab == 8) {
					ac = 3
				} else {
					if (ab == 2) {
						ac = 1
					} else {
						if (ab == 32) {
							ac = 5
						} else {
							if (ab == 4) {
								ac = 2
							} else {
								return this.toRadix(ab)
							}
						}
					}
				}
			}
			var ae = (1 << ac) - 1,
				ah, aa = false,
				af = "",
				ad = this.t;
			var ag = this.DB - (ad * this.DB) % ac;
			if (ad-- > 0) {
				if (ag < this.DB && (ah = this[ad] >> ag) > 0) {
					aa = true;
					af = x(ah)
				}
				while (ad >= 0) {
					if (ag < ac) {
						ah = (this[ad] & ((1 << ag) - 1)) << (ac - ag);
						ah |= this[--ad] >> (ag += this.DB - ac)
					} else {
						ah = (this[ad] >> (ag -= ac)) & ae;
						if (ag <= 0) {
							ag += this.DB;
							--ad
						}
					}
					if (ah > 0) {
						aa = true
					}
					if (aa) {
						af += x(ah)
					}
				}
			}
			return aa ? af : "0"
		}
		function N() {
			var aa = l();
			d.ZERO.subTo(this, aa);
			return aa
		}
		function G() {
			return (this.s < 0) ? this.negate() : this
		}
		function V(aa) {
			var ac = this.s - aa.s;
			if (ac != 0) {
				return ac
			}
			var ab = this.t;
			ac = ab - aa.t;
			if (ac != 0) {
				return ac
			}
			while (--ab >= 0) {
				if ((ac = this[ab] - aa[ab]) != 0) {
					return ac
				}
			}
			return 0
		}
		function U(aa) {
			var ac = 1,
				ab;
			if ((ab = aa >>> 16) != 0) {
				aa = ab;
				ac += 16
			}
			if ((ab = aa >> 8) != 0) {
				aa = ab;
				ac += 8
			}
			if ((ab = aa >> 4) != 0) {
				aa = ab;
				ac += 4
			}
			if ((ab = aa >> 2) != 0) {
				aa = ab;
				ac += 2
			}
			if ((ab = aa >> 1) != 0) {
				aa = ab;
				ac += 1
			}
			return ac
		}
		function g() {
			if (this.t <= 0) {
				return 0
			}
			return this.DB * (this.t - 1) + U(this[this.t - 1] ^ (this.s & this.DM))
		}
		function a(ac, ab) {
			var aa;
			for (aa = this.t - 1; aa >= 0; --aa) {
				ab[aa + ac] = this[aa]
			}
			for (aa = ac - 1; aa >= 0; --aa) {
				ab[aa] = 0
			}
			ab.t = this.t + ac;
			ab.s = this.s
		}
		function z(ac, ab) {
			for (var aa = ac; aa < this.t; ++aa) {
				ab[aa - ac] = this[aa]
			}
			ab.t = Math.max(this.t - ac, 0);
			ab.s = this.s
		}
		function s(ah, ad) {
			var ab = ah % this.DB;
			var aa = this.DB - ab;
			var af = (1 << aa) - 1;
			var ae = Math.floor(ah / this.DB),
				ag = (this.s << ab) & this.DM,
				ac;
			for (ac = this.t - 1; ac >= 0; --ac) {
				ad[ac + ae + 1] = (this[ac] >> aa) | ag;
				ag = (this[ac] & af) << ab
			}
			for (ac = ae - 1; ac >= 0; --ac) {
				ad[ac] = 0
			}
			ad[ae] = ag;
			ad.t = this.t + ae + 1;
			ad.s = this.s;
			ad.clamp()
		}
		function Q(ag, ad) {
			ad.s = this.s;
			var ae = Math.floor(ag / this.DB);
			if (ae >= this.t) {
				ad.t = 0;
				return
			}
			var ab = ag % this.DB;
			var aa = this.DB - ab;
			var af = (1 << ab) - 1;
			ad[0] = this[ae] >> ab;
			for (var ac = ae + 1; ac < this.t; ++ac) {
				ad[ac - ae - 1] |= (this[ac] & af) << aa;
				ad[ac - ae] = this[ac] >> ab
			}
			if (ab > 0) {
				ad[this.t - ae - 1] |= (this.s & af) << aa
			}
			ad.t = this.t - ae;
			ad.clamp()
		}
		function h(ab, ad) {
			var ac = 0,
				ae = 0,
				aa = Math.min(ab.t, this.t);
			while (ac < aa) {
				ae += this[ac] - ab[ac];
				ad[ac++] = ae & this.DM;
				ae >>= this.DB
			}
			if (ab.t < this.t) {
				ae -= ab.s;
				while (ac < this.t) {
					ae += this[ac];
					ad[ac++] = ae & this.DM;
					ae >>= this.DB
				}
				ae += this.s
			} else {
				ae += this.s;
				while (ac < ab.t) {
					ae -= ab[ac];
					ad[ac++] = ae & this.DM;
					ae >>= this.DB
				}
				ae -= ab.s
			}
			ad.s = (ae < 0) ? -1 : 0;
			if (ae < -1) {
				ad[ac++] = this.DV + ae
			} else {
				if (ae > 0) {
					ad[ac++] = ae
				}
			}
			ad.t = ac;
			ad.clamp()
		}
		function O(ab, ad) {
			var aa = this.abs(),
				ae = ab.abs();
			var ac = aa.t;
			ad.t = ac + ae.t;
			while (--ac >= 0) {
				ad[ac] = 0
			}
			for (ac = 0; ac < ae.t; ++ac) {
				ad[ac + aa.t] = aa.am(0, ae[ac], ad, ac, 0, aa.t)
			}
			ad.s = 0;
			ad.clamp();
			if (this.s != ab.s) {
				d.ZERO.subTo(ad, ad)
			}
		}
		function A(ac) {
			var ab, aa = this.abs();
			ab = ac.t = 2 * aa.t;
			while (--ab >= 0) {
				ac[ab] = 0
			}
			for (ab = 0; ab < aa.t - 1; ++ab) {
				var ad = aa.am(ab, aa[ab], ac, 2 * ab, 0, 1);
				if ((ac[ab + aa.t] += aa.am(ab + 1, 2 * aa[ab], ac, 2 * ab + 1, ad, aa.t - ab - 1)) >= aa.DV) {
					ac[ab + aa.t] -= aa.DV;
					ac[ab + aa.t + 1] = 1
				}
			}
			if (ac.t > 0) {
				ac[ac.t - 1] += aa.am(ab, aa[ab], ac, 2 * ab, 0, 1)
			}
			ac.s = 0;
			ac.clamp()
		}
		function I(aj, ag, af) {
			var ap = aj.abs();
			if (ap.t <= 0) {
				return
			}
			var ah = this.abs();
			if (ah.t < ap.t) {
				if (ag != null) {
					ag.fromInt(0)
				}
				if (af != null) {
					this.copyTo(af)
				}
				return
			}
			if (af == null) {
				af = l()
			}
			var ad = l(),
				aa = this.s,
				ai = aj.s;
			var ao = this.DB - U(ap[ap.t - 1]);
			if (ao > 0) {
				ap.lShiftTo(ao, ad);
				ah.lShiftTo(ao, af)
			} else {
				ap.copyTo(ad);
				ah.copyTo(af)
			}
			var al = ad.t;
			var ab = ad[al - 1];
			if (ab == 0) {
				return
			}
			var ak = ab * (1 << this.F1) + ((al > 1) ? ad[al - 2] >> this.F2 : 0);
			var at = this.FV / ak,
				ar = (1 << this.F1) / ak,
				aq = 1 << this.F2;
			var an = af.t,
				am = an - al,
				ae = (ag == null) ? l() : ag;
			ad.dlShiftTo(am, ae);
			if (af.compareTo(ae) >= 0) {
				af[af.t++] = 1;
				af.subTo(ae, af)
			}
			d.ONE.dlShiftTo(al, ae);
			ae.subTo(ad, ad);
			while (ad.t < al) {
				ad[ad.t++] = 0
			}
			while (--am >= 0) {
				var ac = (af[--an] == ab) ? this.DM : Math.floor(af[an] * at + (af[an - 1] + aq) * ar);
				if ((af[an] += ad.am(0, ac, af, am, 0, al)) < ac) {
					ad.dlShiftTo(am, ae);
					af.subTo(ae, af);
					while (af[an] < --ac) {
						af.subTo(ae, af)
					}
				}
			}
			if (ag != null) {
				af.drShiftTo(al, ag);
				if (aa != ai) {
					d.ZERO.subTo(ag, ag)
				}
			}
			af.t = al;
			af.clamp();
			if (ao > 0) {
				af.rShiftTo(ao, af)
			}
			if (aa < 0) {
				d.ZERO.subTo(af, af)
			}
		}
		function j(aa) {
			var ab = l();
			this.abs().divRemTo(aa, null, ab);
			if (this.s < 0 && ab.compareTo(d.ZERO) > 0) {
				aa.subTo(ab, ab)
			}
			return ab
		}
		function W(aa) {
			this.m = aa
		}
		function w(aa) {
			if (aa.s < 0 || aa.compareTo(this.m) >= 0) {
				return aa.mod(this.m)
			} else {
				return aa
			}
		}
		function p(aa) {
			return aa
		}
		function c(aa) {
			aa.divRemTo(this.m, null, aa)
		}
		function X(aa, ac, ab) {
			aa.multiplyTo(ac, ab);
			this.reduce(ab)
		}
		function Y(aa, ab) {
			aa.squareTo(ab);
			this.reduce(ab)
		}
		W.prototype.convert = w;
		W.prototype.revert = p;
		W.prototype.reduce = c;
		W.prototype.mulTo = X;
		W.prototype.sqrTo = Y;
		function r() {
			if (this.t < 1) {
				return 0
			}
			var aa = this[0];
			if ((aa & 1) == 0) {
				return 0
			}
			var ab = aa & 3;
			ab = (ab * (2 - (aa & 15) * ab)) & 15;
			ab = (ab * (2 - (aa & 255) * ab)) & 255;
			ab = (ab * (2 - (((aa & 65535) * ab) & 65535))) & 65535;
			ab = (ab * (2 - aa * ab % this.DV)) % this.DV;
			return (ab > 0) ? this.DV - ab : -ab
		}
		function B(aa) {
			this.m = aa;
			this.mp = aa.invDigit();
			this.mpl = this.mp & 32767;
			this.mph = this.mp >> 15;
			this.um = (1 << (aa.DB - 15)) - 1;
			this.mt2 = 2 * aa.t
		}
		function q(aa) {
			var ab = l();
			aa.abs().dlShiftTo(this.m.t, ab);
			ab.divRemTo(this.m, null, ab);
			if (aa.s < 0 && ab.compareTo(d.ZERO) > 0) {
				this.m.subTo(ab, ab)
			}
			return ab
		}
		function S(aa) {
			var ab = l();
			aa.copyTo(ab);
			this.reduce(ab);
			return ab
		}
		function F(aa) {
			while (aa.t <= this.mt2) {
				aa[aa.t++] = 0
			}
			for (var ac = 0; ac < this.m.t; ++ac) {
				var ab = aa[ac] & 32767;
				var ad = (ab * this.mpl + (((ab * this.mph + (aa[ac] >> 15) * this.mpl) & this.um) << 15)) & aa.DM;
				ab = ac + this.m.t;
				aa[ab] += this.m.am(0, ad, aa, ac, 0, this.m.t);
				while (aa[ab] >= aa.DV) {
					aa[ab] -= aa.DV;
					aa[++ab]++
				}
			}
			aa.clamp();
			aa.drShiftTo(this.m.t, aa);
			if (aa.compareTo(this.m) >= 0) {
				aa.subTo(this.m, aa)
			}
		}
		function k(aa, ab) {
			aa.squareTo(ab);
			this.reduce(ab)
		}
		function i(aa, ac, ab) {
			aa.multiplyTo(ac, ab);
			this.reduce(ab)
		}
		B.prototype.convert = q;
		B.prototype.revert = S;
		B.prototype.reduce = F;
		B.prototype.mulTo = i;
		B.prototype.sqrTo = k;
		function u() {
			return 0 == ((this.t > 0) ? (this[0] & 1) : this.s)
		}
		function e(af, ag) {
			if (af > 4294967295 || af < 1) {
				return d.ONE
			}
			var ae = l(),
				aa = l(),
				ad = ag.convert(this),
				ac = U(af) - 1;
			ad.copyTo(ae);
			while (--ac >= 0) {
				ag.sqrTo(ae, aa);
				if ((af & (1 << ac)) > 0) {
					ag.mulTo(aa, ad, ae)
				} else {
					var ab = ae;
					ae = aa;
					aa = ab
				}
			}
			return ag.revert(ae)
		}
		function D(ab, aa) {
			var ac;
			if (ab < 256 || aa.isEven()) {
				ac = new W(aa)
			} else {
				ac = new B(aa)
			}
			return this.exp(ab, ac)
		}
		d.prototype.copyTo = n;
		d.prototype.fromInt = R;
		d.prototype.fromString = M;
		d.prototype.clamp = P;
		d.prototype.dlShiftTo = a;
		d.prototype.drShiftTo = z;
		d.prototype.lShiftTo = s;
		d.prototype.rShiftTo = Q;
		d.prototype.subTo = h;
		d.prototype.multiplyTo = O;
		d.prototype.squareTo = A;
		d.prototype.divRemTo = I;
		d.prototype.invDigit = r;
		d.prototype.isEven = u;
		d.prototype.exp = e;
		d.prototype.toString = T;
		d.prototype.negate = N;
		d.prototype.abs = G;
		d.prototype.compareTo = V;
		d.prototype.bitLength = g;
		d.prototype.mod = j;
		d.prototype.modPowInt = D;
		d.ZERO = b(0);
		d.ONE = b(1);
		return d
	})();
	SYNO = window.SYNO || {};
	SYNO.Encryption = SYNO.Encryption || {};
	SYNO.Encryption.SecureRandom = (function() {
		function g() {
			this.i = 0;
			this.j = 0;
			this.S = new Array()
		}
		function l(s) {
			var r, p, q;
			for (r = 0; r < 256; ++r) {
				this.S[r] = r
			}
			p = 0;
			for (r = 0; r < 256; ++r) {
				p = (p + this.S[r] + s[r % s.length]) & 255;
				q = this.S[r];
				this.S[r] = this.S[p];
				this.S[p] = q
			}
			this.i = 0;
			this.j = 0
		}
		function d() {
			var p;
			this.i = (this.i + 1) & 255;
			this.j = (this.j + this.S[this.i]) & 255;
			p = this.S[this.i];
			this.S[this.i] = this.S[this.j];
			this.S[this.j] = p;
			return this.S[(p + this.S[this.i]) & 255]
		}
		g.prototype.init = l;
		g.prototype.next = d;
		function j() {
			return new g()
		}
		var m = 256;
		var k;
		var b;
		var f;
		function h(p) {
			b[f++] ^= p & 255;
			b[f++] ^= (p >> 8) & 255;
			b[f++] ^= (p >> 16) & 255;
			b[f++] ^= (p >> 24) & 255;
			if (f >= m) {
				f -= m
			}
		}
		function o() {
			h(new Date().getTime())
		}
		if (b == null) {
			b = new Array();
			f = 0;
			var n;
			if (navigator.appName == "Netscape" && navigator.appVersion < "5" && window.crypto) {
				var i = window.crypto.random(32);
				for (n = 0; n < i.length; ++n) {
					b[f++] = i.charCodeAt(n) & 255
				}
			}
			while (f < m) {
				n = Math.floor(65536 * Math.random());
				b[f++] = n >>> 8;
				b[f++] = n & 255
			}
			f = 0;
			o()
		}
		function c() {
			if (k == null) {
				o();
				k = j();
				k.init(b);
				for (f = 0; f < b.length; ++f) {
					b[f] = 0
				}
				f = 0
			}
			return k.next()
		}
		function e(q) {
			var p;
			for (p = 0; p < q.length; ++p) {
				q[p] = c()
			}
		}
		function a() {}
		a.prototype.nextBytes = e;
		a.rng_seed_time = o;
		return a
	})();
	SYNO = window.SYNO || {};
	SYNO.Encryption = SYNO.Encryption || {};
	SYNO.Encryption.RSA = (function() {
		function c(i, h) {
			return new SYNO.Encryption.BigInteger(i, h)
		}
		function b(h) {
			if (h < 16) {
				return "0" + h.toString(16)
			}
			return h.toString(16)
		}
		function a(l, p) {
			if (p < l.length + 11) {
				return null
			}
			var o = new Array();
			var k = l.length - 1;
			while (k >= 0 && p > 0) {
				var m = l.charCodeAt(k--);
				if (m < 128) {
					o[--p] = m
				} else {
					if ((m > 127) && (m < 2048)) {
						o[--p] = (m & 63) | 128;
						o[--p] = (m >> 6) | 192
					} else {
						o[--p] = (m & 63) | 128;
						o[--p] = ((m >> 6) & 63) | 128;
						o[--p] = (m >> 12) | 224
					}
				}
			}
			o[--p] = 0;
			var j = new SYNO.Encryption.SecureRandom();
			var h = new Array();
			while (p > 2) {
				h[0] = 0;
				while (h[0] == 0) {
					j.nextBytes(h)
				}
				o[--p] = h[0]
			}
			o[--p] = 2;
			o[--p] = 0;
			return new SYNO.Encryption.BigInteger(o)
		}
		function e() {
			this.n = null;
			this.e = 0;
			this.d = null;
			this.p = null;
			this.q = null;
			this.dmp1 = null;
			this.dmq1 = null;
			this.coeff = null
		}
		function f(i, h) {
			if (i != null && h != null && i.length > 0 && h.length > 0) {
				this.n = c(i, 16);
				this.e = parseInt(h, 16)
			} else {}
		}
		function g(h) {
			return h.modPowInt(this.e, this.n)
		}
		function d(k) {
			var i = a(k, (this.n.bitLength() + 7) >> 3);
			if (i == null) {
				return null
			}
			var l = this.doPublic(i);
			if (l == null) {
				return null
			}
			var j = l.toString(16);
			if ((j.length & 1) == 0) {
				return j
			} else {
				return "0" + j
			}
		}
		e.prototype.doPublic = g;
		e.prototype.setPublic = f;
		e.prototype.encrypt = d;
		return e
	})();
	SYNO = window.SYNO || {};
	SYNO.Encryption = SYNO.Encryption || {};
	SYNO.Encryption.CipherKey = "";
	SYNO.Encryption.RSAModulus = "";
	SYNO.Encryption.CipherToken = "";
	SYNO.Encryption.TimeBias = 0;
	SYNO.Encryption.EncryptParam = function(e, cipherKey, rsaModulus, cipherToken, timeBias) {
		var c, d, b = {},
			a = {};
		if (!cipherKey || !rsaModulus || !cipherToken) {
			return e;
		}
		c = new SYNO.Encryption.RSA();
		c.setPublic(rsaModulus, "10001");
		e[cipherToken] = Math.floor(+new Date() / 1000) + timeBias;
		var encodedData = $.param(e).replace(/\+/g, '%20');
		d = c.encrypt(encodedData);
		if (!d) {
			return e;
		}
		a[cipherKey] = SYNO.Encryption.Base64.hex2b64(d);
		return a
	};
})();