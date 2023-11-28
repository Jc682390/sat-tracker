/* Geodesic routines from GeographicLib translated to JavaScript.  See
 * https://geographiclib.sourceforge.io/html/js/
 *
 * The algorithms are derived in
 *
 *    Charles F. F. Karney,
 *    Algorithms for geodesics, J. Geodesy 87, 43-55 (2013),
 *    https://doi.org/10.1007/s00190-012-0578-z
 *    Addenda: https://geographiclib.sourceforge.io/geod-addenda.html
 *
 * This file is the concatenation and compression of the JavaScript files in
 * doc/scripts/GeographicLib in the source tree for GeographicLib.
 *
 * Copyright (c) Charles Karney (2011-2015) <charles@karney.com> and licensed
 * under the MIT/X11 License.  For more information, see
 * https://geographiclib.sourceforge.io/
 *
 * Version: 1.50
 * File inventory:
 *   Math.js Geodesic.js GeodesicLine.js PolygonArea.js DMS.js
 */
(function(cb) {
    // Math.js
    "use strict";
    var GeographicLib = {};
    GeographicLib.Constants = {};
    GeographicLib.Math = {};
    GeographicLib.Accumulator = {};
    (function(c) {
        c.WGS84 = {
            a: 6378137,
            f: 1 / 298.257223563
        };
        c.version = {
            major: 1,
            minor: 50,
            patch: 0
        };
        c.version_string = "1.50";
    }
    )(GeographicLib.Constants);
    (function(m) {
        m.digits = 53;
        m.epsilon = Math.pow(0.5, m.digits - 1);
        m.degree = Math.PI / 180;
        m.sq = function(x) {
            return x * x;
        }
        ;
        m.hypot = Math.hypot || function(x, y) {
            var a, b;
            x = Math.abs(x);
            y = Math.abs(y);
            a = Math.max(x, y);
            b = Math.min(x, y) / (a ? a : 1);
            return a * Math.sqrt(1 + b * b);
        }
        ;
        m.cbrt = Math.cbrt || function(x) {
            var y = Math.pow(Math.abs(x), 1 / 3);
            return x > 0 ? y : (x < 0 ? -y : x);
        }
        ;
        m.log1p = Math.log1p || function(x) {
            var y = 1 + x
              , z = y - 1;
            return z === 0 ? x : x * Math.log(y) / z;
        }
        ;
        m.atanh = Math.atanh || function(x) {
            var y = Math.abs(x);
            y = m.log1p(2 * y / (1 - y)) / 2;
            return x > 0 ? y : (x < 0 ? -y : x);
        }
        ;
        m.copysign = function(x, y) {
            return Math.abs(x) * (y < 0 || (y === 0 && 1 / y < 0) ? -1 : 1);
        }
        ;
        m.sum = function(u, v) {
            var s = u + v, up = s - v, vpp = s - up, t;
            up -= u;
            vpp -= v;
            t = -(up + vpp);
            return {
                s: s,
                t: t
            };
        }
        ;
        m.polyval = function(N, p, s, x) {
            var y = N < 0 ? 0 : p[s++];
            while (--N >= 0)
                y = y * x + p[s++];
            return y;
        }
        ;
        m.AngRound = function(x) {
            if (x === 0)
                return x;
            var z = 1 / 16
              , y = Math.abs(x);
            y = y < z ? z - (z - y) : y;
            return x < 0 ? -y : y;
        }
        ;
        m.remainder = function(x, y) {
            x = x % y;
            return x < -y / 2 ? x + y : (x < y / 2 ? x : x - y);
        }
        ;
        m.AngNormalize = function(x) {
            x = m.remainder(x, 360);
            return x == -180 ? 180 : x;
        }
        ;
        m.LatFix = function(x) {
            return Math.abs(x) > 90 ? Number.NaN : x;
        }
        ;
        m.AngDiff = function(x, y) {
            var r = m.sum(m.AngNormalize(-x), m.AngNormalize(y))
              , d = m.AngNormalize(r.s)
              , t = r.t;
            return m.sum(d === 180 && t > 0 ? -180 : d, t);
        }
        ;
        m.sincosd = function(x) {
            var r, q, s, c, sinx, cosx;
            r = x % 360;
            q = 0 + Math.round(r / 90);
            r -= 90 * q;
            r *= this.degree;
            s = Math.sin(r);
            c = Math.cos(r);
            switch (q & 3) {
            case 0:
                sinx = s;
                cosx = c;
                break;
            case 1:
                sinx = c;
                cosx = -s;
                break;
            case 2:
                sinx = -s;
                cosx = -c;
                break;
            default:
                sinx = -c;
                cosx = s;
                break;
            }
            if (x !== 0) {
                sinx += 0;
                cosx += 0;
            }
            return {
                s: sinx,
                c: cosx
            };
        }
        ;
        m.atan2d = function(y, x) {
            var q = 0, t, ang;
            if (Math.abs(y) > Math.abs(x)) {
                t = x;
                x = y;
                y = t;
                q = 2;
            }
            if (x < 0) {
                x = -x;
                ++q;
            }
            ang = Math.atan2(y, x) / this.degree;
            switch (q) {
            case 1:
                ang = (y >= 0 ? 180 : -180) - ang;
                break;
            case 2:
                ang = 90 - ang;
                break;
            case 3:
                ang = -90 + ang;
                break;
            }
            return ang;
        }
        ;
    }
    )(GeographicLib.Math);
    (function(a, m) {
        a.Accumulator = function(y) {
            this.Set(y);
        }
        ;
        a.Accumulator.prototype.Set = function(y) {
            if (!y)
                y = 0;
            if (y.constructor === a.Accumulator) {
                this._s = y._s;
                this._t = y._t;
            } else {
                this._s = y;
                this._t = 0;
            }
        }
        ;
        a.Accumulator.prototype.Add = function(y) {
            var u = m.sum(y, this._t)
              , v = m.sum(u.s, this._s);
            u = u.t;
            this._s = v.s;
            this._t = v.t;
            if (this._s === 0)
                this._s = u;
            else
                this._t += u;
        }
        ;
        a.Accumulator.prototype.Sum = function(y) {
            var b;
            if (!y)
                return this._s;
            else {
                b = new a.Accumulator(this);
                b.Add(y);
                return b._s;
            }
        }
        ;
        a.Accumulator.prototype.Negate = function() {
            this._s *= -1;
            this._t *= -1;
        }
        ;
        a.Accumulator.prototype.Remainder = function(y) {
            this._s = m.remainder(this._s, y);
            this.Add(0);
        }
        ;
    }
    )(GeographicLib.Accumulator, GeographicLib.Math);
    // Geodesic.js
    GeographicLib.Geodesic = {};
    GeographicLib.GeodesicLine = {};
    GeographicLib.PolygonArea = {};
    (function(g, l, p, m, c) {
        var GEOGRAPHICLIB_GEODESIC_ORDER = 6, nA1_ = GEOGRAPHICLIB_GEODESIC_ORDER, nA2_ = GEOGRAPHICLIB_GEODESIC_ORDER, nA3_ = GEOGRAPHICLIB_GEODESIC_ORDER, nA3x_ = nA3_, nC3x_, nC4x_, maxit1_ = 20, maxit2_ = maxit1_ + m.digits + 10, tol0_ = m.epsilon, tol1_ = 200 * tol0_, tol2_ = Math.sqrt(tol0_), tolb_ = tol0_ * tol1_, xthresh_ = 1000 * tol2_, CAP_NONE = 0, CAP_ALL = 0x1F, CAP_MASK = CAP_ALL, OUT_ALL = 0x7F80, astroid, A1m1f_coeff, C1f_coeff, C1pf_coeff, A2m1f_coeff, C2f_coeff, A3_coeff, C3_coeff, C4_coeff;
        g.tiny_ = Math.sqrt(Number.MIN_VALUE);
        g.nC1_ = GEOGRAPHICLIB_GEODESIC_ORDER;
        g.nC1p_ = GEOGRAPHICLIB_GEODESIC_ORDER;
        g.nC2_ = GEOGRAPHICLIB_GEODESIC_ORDER;
        g.nC3_ = GEOGRAPHICLIB_GEODESIC_ORDER;
        g.nC4_ = GEOGRAPHICLIB_GEODESIC_ORDER;
        nC3x_ = (g.nC3_ * (g.nC3_ - 1)) / 2;
        nC4x_ = (g.nC4_ * (g.nC4_ + 1)) / 2;
        g.CAP_C1 = 1 << 0;
        g.CAP_C1p = 1 << 1;
        g.CAP_C2 = 1 << 2;
        g.CAP_C3 = 1 << 3;
        g.CAP_C4 = 1 << 4;
        g.NONE = 0;
        g.ARC = 1 << 6;
        g.LATITUDE = 1 << 7 | CAP_NONE;
        g.LONGITUDE = 1 << 8 | g.CAP_C3;
        g.AZIMUTH = 1 << 9 | CAP_NONE;
        g.DISTANCE = 1 << 10 | g.CAP_C1;
        g.STANDARD = g.LATITUDE | g.LONGITUDE | g.AZIMUTH | g.DISTANCE;
        g.DISTANCE_IN = 1 << 11 | g.CAP_C1 | g.CAP_C1p;
        g.REDUCEDLENGTH = 1 << 12 | g.CAP_C1 | g.CAP_C2;
        g.GEODESICSCALE = 1 << 13 | g.CAP_C1 | g.CAP_C2;
        g.AREA = 1 << 14 | g.CAP_C4;
        g.ALL = OUT_ALL | CAP_ALL;
        g.LONG_UNROLL = 1 << 15;
        g.OUT_MASK = OUT_ALL | g.LONG_UNROLL;
        g.SinCosSeries = function(sinp, sinx, cosx, c) {
            var k = c.length
              , n = k - (sinp ? 1 : 0)
              , ar = 2 * (cosx - sinx) * (cosx + sinx)
              , y0 = n & 1 ? c[--k] : 0
              , y1 = 0;
            n = Math.floor(n / 2);
            while (n--) {
                y1 = ar * y0 - y1 + c[--k];
                y0 = ar * y1 - y0 + c[--k];
            }
            return (sinp ? 2 * sinx * cosx * y0 : cosx * (y0 - y1));
        }
        ;
        astroid = function(x, y) {
            var k, p = m.sq(x), q = m.sq(y), r = (p + q - 1) / 6, S, r2, r3, disc, u, T3, T, ang, v, uv, w;
            if (!(q === 0 && r <= 0)) {
                S = p * q / 4;
                r2 = m.sq(r);
                r3 = r * r2;
                disc = S * (S + 2 * r3);
                u = r;
                if (disc >= 0) {
                    T3 = S + r3;
                    T3 += T3 < 0 ? -Math.sqrt(disc) : Math.sqrt(disc);
                    T = m.cbrt(T3);
                    u += T + (T !== 0 ? r2 / T : 0);
                } else {
                    ang = Math.atan2(Math.sqrt(-disc), -(S + r3));
                    u += 2 * r * Math.cos(ang / 3);
                }
                v = Math.sqrt(m.sq(u) + q);
                uv = u < 0 ? q / (v - u) : u + v;
                w = (uv - q) / (2 * v);
                k = uv / (Math.sqrt(uv + m.sq(w)) + w);
            } else {
                k = 0;
            }
            return k;
        }
        ;
        A1m1f_coeff = [+1, 4, 64, 0, 256];
        g.A1m1f = function(eps) {
            var p = Math.floor(nA1_ / 2)
              , t = m.polyval(p, A1m1f_coeff, 0, m.sq(eps)) / A1m1f_coeff[p + 1];
            return (t + eps) / (1 - eps);
        }
        ;
        C1f_coeff = [-1, 6, -16, 32, -9, 64, -128, 2048, +9, -16, 768, +3, -5, 512, -7, 1280, -7, 2048];
        g.C1f = function(eps, c) {
            var eps2 = m.sq(eps), d = eps, o = 0, l, p;
            for (l = 1; l <= g.nC1_; ++l) {
                p = Math.floor((g.nC1_ - l) / 2);
                c[l] = d * m.polyval(p, C1f_coeff, o, eps2) / C1f_coeff[o + p + 1];
                o += p + 2;
                d *= eps;
            }
        }
        ;
        C1pf_coeff = [+205, -432, 768, 1536, +4005, -4736, 3840, 12288, -225, 116, 384, -7173, 2695, 7680, +3467, 7680, +38081, 61440];
        g.C1pf = function(eps, c) {
            var eps2 = m.sq(eps), d = eps, o = 0, l, p;
            for (l = 1; l <= g.nC1p_; ++l) {
                p = Math.floor((g.nC1p_ - l) / 2);
                c[l] = d * m.polyval(p, C1pf_coeff, o, eps2) / C1pf_coeff[o + p + 1];
                o += p + 2;
                d *= eps;
            }
        }
        ;
        A2m1f_coeff = [-11, -28, -192, 0, 256];
        g.A2m1f = function(eps) {
            var p = Math.floor(nA2_ / 2)
              , t = m.polyval(p, A2m1f_coeff, 0, m.sq(eps)) / A2m1f_coeff[p + 1];
            return (t - eps) / (1 + eps);
        }
        ;
        C2f_coeff = [+1, 2, 16, 32, +35, 64, 384, 2048, +15, 80, 768, +7, 35, 512, +63, 1280, +77, 2048];
        g.C2f = function(eps, c) {
            var eps2 = m.sq(eps), d = eps, o = 0, l, p;
            for (l = 1; l <= g.nC2_; ++l) {
                p = Math.floor((g.nC2_ - l) / 2);
                c[l] = d * m.polyval(p, C2f_coeff, o, eps2) / C2f_coeff[o + p + 1];
                o += p + 2;
                d *= eps;
            }
        }
        ;
        g.Geodesic = function(a, f) {
            this.a = a;
            this.f = f;
            this._f1 = 1 - this.f;
            this._e2 = this.f * (2 - this.f);
            this._ep2 = this._e2 / m.sq(this._f1);
            this._n = this.f / (2 - this.f);
            this._b = this.a * this._f1;
            this._c2 = (m.sq(this.a) + m.sq(this._b) * (this._e2 === 0 ? 1 : (this._e2 > 0 ? m.atanh(Math.sqrt(this._e2)) : Math.atan(Math.sqrt(-this._e2))) / Math.sqrt(Math.abs(this._e2)))) / 2;
            this._etol2 = 0.1 * tol2_ / Math.sqrt(Math.max(0.001, Math.abs(this.f)) * Math.min(1.0, 1 - this.f / 2) / 2);
            if (!(isFinite(this.a) && this.a > 0))
                throw new Error("Equatorial radius is not positive");
            if (!(isFinite(this._b) && this._b > 0))
                throw new Error("Polar semi-axis is not positive");
            this._A3x = new Array(nA3x_);
            this._C3x = new Array(nC3x_);
            this._C4x = new Array(nC4x_);
            this.A3coeff();
            this.C3coeff();
            this.C4coeff();
        }
        ;
        A3_coeff = [-3, 128, -2, -3, 64, -1, -3, -1, 16, +3, -1, -2, 8, +1, -1, 2, +1, 1];
        g.Geodesic.prototype.A3coeff = function() {
            var o = 0, k = 0, j, p;
            for (j = nA3_ - 1; j >= 0; --j) {
                p = Math.min(nA3_ - j - 1, j);
                this._A3x[k++] = m.polyval(p, A3_coeff, o, this._n) / A3_coeff[o + p + 1];
                o += p + 2;
            }
        }
        ;
        C3_coeff = [+3, 128, +2, 5, 128, -1, 3, 3, 64, -1, 0, 1, 8, -1, 1, 4, +5, 256, +1, 3, 128, -3, -2, 3, 64, +1, -3, 2, 32, +7, 512, -10, 9, 384, +5, -9, 5, 192, +7, 512, -14, 7, 512, +21, 2560];
        g.Geodesic.prototype.C3coeff = function() {
            var o = 0, k = 0, l, j, p;
            for (l = 1; l < g.nC3_; ++l) {
                for (j = g.nC3_ - 1; j >= l; --j) {
                    p = Math.min(g.nC3_ - j - 1, j);
                    this._C3x[k++] = m.polyval(p, C3_coeff, o, this._n) / C3_coeff[o + p + 1];
                    o += p + 2;
                }
            }
        }
        ;
        C4_coeff = [+97, 15015, +1088, 156, 45045, -224, -4784, 1573, 45045, -10656, 14144, -4576, -858, 45045, +64, 624, -4576, 6864, -3003, 15015, +100, 208, 572, 3432, -12012, 30030, 45045, +1, 9009, -2944, 468, 135135, +5792, 1040, -1287, 135135, +5952, -11648, 9152, -2574, 135135, -64, -624, 4576, -6864, 3003, 135135, +8, 10725, +1856, -936, 225225, -8448, 4992, -1144, 225225, -1440, 4160, -4576, 1716, 225225, -136, 63063, +1024, -208, 105105, +3584, -3328, 1144, 315315, -128, 135135, -2560, 832, 405405, +128, 99099];
        g.Geodesic.prototype.C4coeff = function() {
            var o = 0, k = 0, l, j, p;
            for (l = 0; l < g.nC4_; ++l) {
                for (j = g.nC4_ - 1; j >= l; --j) {
                    p = g.nC4_ - j - 1;
                    this._C4x[k++] = m.polyval(p, C4_coeff, o, this._n) / C4_coeff[o + p + 1];
                    o += p + 2;
                }
            }
        }
        ;
        g.Geodesic.prototype.A3f = function(eps) {
            return m.polyval(nA3x_ - 1, this._A3x, 0, eps);
        }
        ;
        g.Geodesic.prototype.C3f = function(eps, c) {
            var mult = 1, o = 0, l, p;
            for (l = 1; l < g.nC3_; ++l) {
                p = g.nC3_ - l - 1;
                mult *= eps;
                c[l] = mult * m.polyval(p, this._C3x, o, eps);
                o += p + 1;
            }
        }
        ;
        g.Geodesic.prototype.C4f = function(eps, c) {
            var mult = 1, o = 0, l, p;
            for (l = 0; l < g.nC4_; ++l) {
                p = g.nC4_ - l - 1;
                c[l] = mult * m.polyval(p, this._C4x, o, eps);
                o += p + 1;
                mult *= eps;
            }
        }
        ;
        g.Geodesic.prototype.Lengths = function(eps, sig12, ssig1, csig1, dn1, ssig2, csig2, dn2, cbet1, cbet2, outmask, C1a, C2a) {
            outmask &= g.OUT_MASK;
            var vals = {}, m0x = 0, J12 = 0, A1 = 0, A2 = 0, B1, B2, l, csig12, t;
            if (outmask & (g.DISTANCE | g.REDUCEDLENGTH | g.GEODESICSCALE)) {
                A1 = g.A1m1f(eps);
                g.C1f(eps, C1a);
                if (outmask & (g.REDUCEDLENGTH | g.GEODESICSCALE)) {
                    A2 = g.A2m1f(eps);
                    g.C2f(eps, C2a);
                    m0x = A1 - A2;
                    A2 = 1 + A2;
                }
                A1 = 1 + A1;
            }
            if (outmask & g.DISTANCE) {
                B1 = g.SinCosSeries(true, ssig2, csig2, C1a) - g.SinCosSeries(true, ssig1, csig1, C1a);
                vals.s12b = A1 * (sig12 + B1);
                if (outmask & (g.REDUCEDLENGTH | g.GEODESICSCALE)) {
                    B2 = g.SinCosSeries(true, ssig2, csig2, C2a) - g.SinCosSeries(true, ssig1, csig1, C2a);
                    J12 = m0x * sig12 + (A1 * B1 - A2 * B2);
                }
            } else if (outmask & (g.REDUCEDLENGTH | g.GEODESICSCALE)) {
                for (l = 1; l <= g.nC2_; ++l)
                    C2a[l] = A1 * C1a[l] - A2 * C2a[l];
                J12 = m0x * sig12 + (g.SinCosSeries(true, ssig2, csig2, C2a) - g.SinCosSeries(true, ssig1, csig1, C2a));
            }
            if (outmask & g.REDUCEDLENGTH) {
                vals.m0 = m0x;
                vals.m12b = dn2 * (csig1 * ssig2) - dn1 * (ssig1 * csig2) - csig1 * csig2 * J12;
            }
            if (outmask & g.GEODESICSCALE) {
                csig12 = csig1 * csig2 + ssig1 * ssig2;
                t = this._ep2 * (cbet1 - cbet2) * (cbet1 + cbet2) / (dn1 + dn2);
                vals.M12 = csig12 + (t * ssig2 - csig2 * J12) * ssig1 / dn1;
                vals.M21 = csig12 - (t * ssig1 - csig1 * J12) * ssig2 / dn2;
            }
            return vals;
        }
        ;
        g.Geodesic.prototype.InverseStart = function(sbet1, cbet1, dn1, sbet2, cbet2, dn2, lam12, slam12, clam12, C1a, C2a) {
            var vals = {}, sbet12 = sbet2 * cbet1 - cbet2 * sbet1, cbet12 = cbet2 * cbet1 + sbet2 * sbet1, sbet12a, shortline, omg12, sbetm2, somg12, comg12, t, ssig12, csig12, x, y, lamscale, betscale, k2, eps, cbet12a, bet12a, m12b, m0, nvals, k, omg12a, lam12x;
            vals.sig12 = -1;
            sbet12a = sbet2 * cbet1;
            sbet12a += cbet2 * sbet1;
            shortline = cbet12 >= 0 && sbet12 < 0.5 && cbet2 * lam12 < 0.5;
            if (shortline) {
                sbetm2 = m.sq(sbet1 + sbet2);
                sbetm2 /= sbetm2 + m.sq(cbet1 + cbet2);
                vals.dnm = Math.sqrt(1 + this._ep2 * sbetm2);
                omg12 = lam12 / (this._f1 * vals.dnm);
                somg12 = Math.sin(omg12);
                comg12 = Math.cos(omg12);
            } else {
                somg12 = slam12;
                comg12 = clam12;
            }
            vals.salp1 = cbet2 * somg12;
            vals.calp1 = comg12 >= 0 ? sbet12 + cbet2 * sbet1 * m.sq(somg12) / (1 + comg12) : sbet12a - cbet2 * sbet1 * m.sq(somg12) / (1 - comg12);
            ssig12 = m.hypot(vals.salp1, vals.calp1);
            csig12 = sbet1 * sbet2 + cbet1 * cbet2 * comg12;
            if (shortline && ssig12 < this._etol2) {
                vals.salp2 = cbet1 * somg12;
                vals.calp2 = sbet12 - cbet1 * sbet2 * (comg12 >= 0 ? m.sq(somg12) / (1 + comg12) : 1 - comg12);
                t = m.hypot(vals.salp2, vals.calp2);
                vals.salp2 /= t;
                vals.calp2 /= t;
                vals.sig12 = Math.atan2(ssig12, csig12);
            } else if (Math.abs(this._n) > 0.1 || csig12 >= 0 || ssig12 >= 6 * Math.abs(this._n) * Math.PI * m.sq(cbet1)) {} else {
                lam12x = Math.atan2(-slam12, -clam12);
                if (this.f >= 0) {
                    k2 = m.sq(sbet1) * this._ep2;
                    eps = k2 / (2 * (1 + Math.sqrt(1 + k2)) + k2);
                    lamscale = this.f * cbet1 * this.A3f(eps) * Math.PI;
                    betscale = lamscale * cbet1;
                    x = lam12x / lamscale;
                    y = sbet12a / betscale;
                } else {
                    cbet12a = cbet2 * cbet1 - sbet2 * sbet1;
                    bet12a = Math.atan2(sbet12a, cbet12a);
                    nvals = this.Lengths(this._n, Math.PI + bet12a, sbet1, -cbet1, dn1, sbet2, cbet2, dn2, cbet1, cbet2, g.REDUCEDLENGTH, C1a, C2a);
                    m12b = nvals.m12b;
                    m0 = nvals.m0;
                    x = -1 + m12b / (cbet1 * cbet2 * m0 * Math.PI);
                    betscale = x < -0.01 ? sbet12a / x : -this.f * m.sq(cbet1) * Math.PI;
                    lamscale = betscale / cbet1;
                    y = lam12 / lamscale;
                }
                if (y > -tol1_ && x > -1 - xthresh_) {
                    if (this.f >= 0) {
                        vals.salp1 = Math.min(1, -x);
                        vals.calp1 = -Math.sqrt(1 - m.sq(vals.salp1));
                    } else {
                        vals.calp1 = Math.max(x > -tol1_ ? 0 : -1, x);
                        vals.salp1 = Math.sqrt(1 - m.sq(vals.calp1));
                    }
                } else {
                    k = astroid(x, y);
                    omg12a = lamscale * (this.f >= 0 ? -x * k / (1 + k) : -y * (1 + k) / k);
                    somg12 = Math.sin(omg12a);
                    comg12 = -Math.cos(omg12a);
                    vals.salp1 = cbet2 * somg12;
                    vals.calp1 = sbet12a - cbet2 * sbet1 * m.sq(somg12) / (1 - comg12);
                }
            }
            if (!(vals.salp1 <= 0.0)) {
                t = m.hypot(vals.salp1, vals.calp1);
                vals.salp1 /= t;
                vals.calp1 /= t;
            } else {
                vals.salp1 = 1;
                vals.calp1 = 0;
            }
            return vals;
        }
        ;
        g.Geodesic.prototype.Lambda12 = function(sbet1, cbet1, dn1, sbet2, cbet2, dn2, salp1, calp1, slam120, clam120, diffp, C1a, C2a, C3a) {
            var vals = {}, t, salp0, calp0, somg1, comg1, somg2, comg2, somg12, comg12, B312, eta, k2, nvals;
            if (sbet1 === 0 && calp1 === 0)
                calp1 = -g.tiny_;
            salp0 = salp1 * cbet1;
            calp0 = m.hypot(calp1, salp1 * sbet1);
            vals.ssig1 = sbet1;
            somg1 = salp0 * sbet1;
            vals.csig1 = comg1 = calp1 * cbet1;
            t = m.hypot(vals.ssig1, vals.csig1);
            vals.ssig1 /= t;
            vals.csig1 /= t;
            vals.salp2 = cbet2 !== cbet1 ? salp0 / cbet2 : salp1;
            vals.calp2 = cbet2 !== cbet1 || Math.abs(sbet2) !== -sbet1 ? Math.sqrt(m.sq(calp1 * cbet1) + (cbet1 < -sbet1 ? (cbet2 - cbet1) * (cbet1 + cbet2) : (sbet1 - sbet2) * (sbet1 + sbet2))) / cbet2 : Math.abs(calp1);
            vals.ssig2 = sbet2;
            somg2 = salp0 * sbet2;
            vals.csig2 = comg2 = vals.calp2 * cbet2;
            t = m.hypot(vals.ssig2, vals.csig2);
            vals.ssig2 /= t;
            vals.csig2 /= t;
            vals.sig12 = Math.atan2(Math.max(0, vals.csig1 * vals.ssig2 - vals.ssig1 * vals.csig2), vals.csig1 * vals.csig2 + vals.ssig1 * vals.ssig2);
            somg12 = Math.max(0, comg1 * somg2 - somg1 * comg2);
            comg12 = comg1 * comg2 + somg1 * somg2;
            eta = Math.atan2(somg12 * clam120 - comg12 * slam120, comg12 * clam120 + somg12 * slam120);
            k2 = m.sq(calp0) * this._ep2;
            vals.eps = k2 / (2 * (1 + Math.sqrt(1 + k2)) + k2);
            this.C3f(vals.eps, C3a);
            B312 = (g.SinCosSeries(true, vals.ssig2, vals.csig2, C3a) - g.SinCosSeries(true, vals.ssig1, vals.csig1, C3a));
            vals.domg12 = -this.f * this.A3f(vals.eps) * salp0 * (vals.sig12 + B312);
            vals.lam12 = eta + vals.domg12;
            if (diffp) {
                if (vals.calp2 === 0)
                    vals.dlam12 = -2 * this._f1 * dn1 / sbet1;
                else {
                    nvals = this.Lengths(vals.eps, vals.sig12, vals.ssig1, vals.csig1, dn1, vals.ssig2, vals.csig2, dn2, cbet1, cbet2, g.REDUCEDLENGTH, C1a, C2a);
                    vals.dlam12 = nvals.m12b;
                    vals.dlam12 *= this._f1 / (vals.calp2 * cbet2);
                }
            }
            return vals;
        }
        ;
        g.Geodesic.prototype.Inverse = function(lat1, lon1, lat2, lon2, outmask) {
            var r, vals;
            if (!outmask)
                outmask = g.STANDARD;
            if (outmask === g.LONG_UNROLL)
                outmask |= g.STANDARD;
            outmask &= g.OUT_MASK;
            r = this.InverseInt(lat1, lon1, lat2, lon2, outmask);
            vals = r.vals;
            if (outmask & g.AZIMUTH) {
                vals.azi1 = m.atan2d(r.salp1, r.calp1);
                vals.azi2 = m.atan2d(r.salp2, r.calp2);
            }
            return vals;
        }
        ;
        g.Geodesic.prototype.InverseInt = function(lat1, lon1, lat2, lon2, outmask) {
            var vals = {}, lon12, lon12s, lonsign, t, swapp, latsign, sbet1, cbet1, sbet2, cbet2, s12x, m12x, dn1, dn2, lam12, slam12, clam12, sig12, calp1, salp1, calp2, salp2, C1a, C2a, C3a, meridian, nvals, ssig1, csig1, ssig2, csig2, eps, omg12, dnm, numit, salp1a, calp1a, salp1b, calp1b, tripn, tripb, v, dv, dalp1, sdalp1, cdalp1, nsalp1, lengthmask, salp0, calp0, alp12, k2, A4, C4a, B41, B42, somg12, comg12, domg12, dbet1, dbet2, salp12, calp12, sdomg12, cdomg12;
            vals.lat1 = lat1 = m.LatFix(lat1);
            vals.lat2 = lat2 = m.LatFix(lat2);
            lat1 = m.AngRound(lat1);
            lat2 = m.AngRound(lat2);
            lon12 = m.AngDiff(lon1, lon2);
            lon12s = lon12.t;
            lon12 = lon12.s;
            if (outmask & g.LONG_UNROLL) {
                vals.lon1 = lon1;
                vals.lon2 = (lon1 + lon12) + lon12s;
            } else {
                vals.lon1 = m.AngNormalize(lon1);
                vals.lon2 = m.AngNormalize(lon2);
            }
            lonsign = lon12 >= 0 ? 1 : -1;
            lon12 = lonsign * m.AngRound(lon12);
            lon12s = m.AngRound((180 - lon12) - lonsign * lon12s);
            lam12 = lon12 * m.degree;
            t = m.sincosd(lon12 > 90 ? lon12s : lon12);
            slam12 = t.s;
            clam12 = (lon12 > 90 ? -1 : 1) * t.c;
            swapp = Math.abs(lat1) < Math.abs(lat2) ? -1 : 1;
            if (swapp < 0) {
                lonsign *= -1;
                t = lat1;
                lat1 = lat2;
                lat2 = t;
            }
            latsign = lat1 < 0 ? 1 : -1;
            lat1 *= latsign;
            lat2 *= latsign;
            t = m.sincosd(lat1);
            sbet1 = this._f1 * t.s;
            cbet1 = t.c;
            t = m.hypot(sbet1, cbet1);
            sbet1 /= t;
            cbet1 /= t;
            cbet1 = Math.max(g.tiny_, cbet1);
            t = m.sincosd(lat2);
            sbet2 = this._f1 * t.s;
            cbet2 = t.c;
            t = m.hypot(sbet2, cbet2);
            sbet2 /= t;
            cbet2 /= t;
            cbet2 = Math.max(g.tiny_, cbet2);
            if (cbet1 < -sbet1) {
                if (cbet2 === cbet1)
                    sbet2 = sbet2 < 0 ? sbet1 : -sbet1;
            } else {
                if (Math.abs(sbet2) === -sbet1)
                    cbet2 = cbet1;
            }
            dn1 = Math.sqrt(1 + this._ep2 * m.sq(sbet1));
            dn2 = Math.sqrt(1 + this._ep2 * m.sq(sbet2));
            C1a = new Array(g.nC1_ + 1);
            C2a = new Array(g.nC2_ + 1);
            C3a = new Array(g.nC3_);
            meridian = lat1 === -90 || slam12 === 0;
            if (meridian) {
                calp1 = clam12;
                salp1 = slam12;
                calp2 = 1;
                salp2 = 0;
                ssig1 = sbet1;
                csig1 = calp1 * cbet1;
                ssig2 = sbet2;
                csig2 = calp2 * cbet2;
                sig12 = Math.atan2(Math.max(0, csig1 * ssig2 - ssig1 * csig2), csig1 * csig2 + ssig1 * ssig2);
                nvals = this.Lengths(this._n, sig12, ssig1, csig1, dn1, ssig2, csig2, dn2, cbet1, cbet2, outmask | g.DISTANCE | g.REDUCEDLENGTH, C1a, C2a);
                s12x = nvals.s12b;
                m12x = nvals.m12b;
                if (outmask & g.GEODESICSCALE) {
                    vals.M12 = nvals.M12;
                    vals.M21 = nvals.M21;
                }
                if (sig12 < 1 || m12x >= 0) {
                    if (sig12 < 3 * g.tiny_)
                        sig12 = m12x = s12x = 0;
                    m12x *= this._b;
                    s12x *= this._b;
                    vals.a12 = sig12 / m.degree;
                } else
                    meridian = false;
            }
            somg12 = 2;
            if (!meridian && sbet1 === 0 && (this.f <= 0 || lon12s >= this.f * 180)) {
                calp1 = calp2 = 0;
                salp1 = salp2 = 1;
                s12x = this.a * lam12;
                sig12 = omg12 = lam12 / this._f1;
                m12x = this._b * Math.sin(sig12);
                if (outmask & g.GEODESICSCALE)
                    vals.M12 = vals.M21 = Math.cos(sig12);
                vals.a12 = lon12 / this._f1;
            } else if (!meridian) {
                nvals = this.InverseStart(sbet1, cbet1, dn1, sbet2, cbet2, dn2, lam12, slam12, clam12, C1a, C2a);
                sig12 = nvals.sig12;
                salp1 = nvals.salp1;
                calp1 = nvals.calp1;
                if (sig12 >= 0) {
                    salp2 = nvals.salp2;
                    calp2 = nvals.calp2;
                    dnm = nvals.dnm;
                    s12x = sig12 * this._b * dnm;
                    m12x = m.sq(dnm) * this._b * Math.sin(sig12 / dnm);
                    if (outmask & g.GEODESICSCALE)
                        vals.M12 = vals.M21 = Math.cos(sig12 / dnm);
                    vals.a12 = sig12 / m.degree;
                    omg12 = lam12 / (this._f1 * dnm);
                } else {
                    numit = 0;
                    salp1a = g.tiny_;
                    calp1a = 1;
                    salp1b = g.tiny_;
                    calp1b = -1;
                    for (tripn = false,
                    tripb = false; numit < maxit2_; ++numit) {
                        nvals = this.Lambda12(sbet1, cbet1, dn1, sbet2, cbet2, dn2, salp1, calp1, slam12, clam12, numit < maxit1_, C1a, C2a, C3a);
                        v = nvals.lam12;
                        salp2 = nvals.salp2;
                        calp2 = nvals.calp2;
                        sig12 = nvals.sig12;
                        ssig1 = nvals.ssig1;
                        csig1 = nvals.csig1;
                        ssig2 = nvals.ssig2;
                        csig2 = nvals.csig2;
                        eps = nvals.eps;
                        domg12 = nvals.domg12;
                        dv = nvals.dlam12;
                        if (tripb || !(Math.abs(v) >= (tripn ? 8 : 1) * tol0_))
                            break;
                        if (v > 0 && (numit < maxit1_ || calp1 / salp1 > calp1b / salp1b)) {
                            salp1b = salp1;
                            calp1b = calp1;
                        } else if (v < 0 && (numit < maxit1_ || calp1 / salp1 < calp1a / salp1a)) {
                            salp1a = salp1;
                            calp1a = calp1;
                        }
                        if (numit < maxit1_ && dv > 0) {
                            dalp1 = -v / dv;
                            sdalp1 = Math.sin(dalp1);
                            cdalp1 = Math.cos(dalp1);
                            nsalp1 = salp1 * cdalp1 + calp1 * sdalp1;
                            if (nsalp1 > 0 && Math.abs(dalp1) < Math.PI) {
                                calp1 = calp1 * cdalp1 - salp1 * sdalp1;
                                salp1 = nsalp1;
                                t = m.hypot(salp1, calp1);
                                salp1 /= t;
                                calp1 /= t;
                                tripn = Math.abs(v) <= 16 * tol0_;
                                continue;
                            }
                        }
                        salp1 = (salp1a + salp1b) / 2;
                        calp1 = (calp1a + calp1b) / 2;
                        t = m.hypot(salp1, calp1);
                        salp1 /= t;
                        calp1 /= t;
                        tripn = false;
                        tripb = (Math.abs(salp1a - salp1) + (calp1a - calp1) < tolb_ || Math.abs(salp1 - salp1b) + (calp1 - calp1b) < tolb_);
                    }
                    lengthmask = outmask | (outmask & (g.REDUCEDLENGTH | g.GEODESICSCALE) ? g.DISTANCE : g.NONE);
                    nvals = this.Lengths(eps, sig12, ssig1, csig1, dn1, ssig2, csig2, dn2, cbet1, cbet2, lengthmask, C1a, C2a);
                    s12x = nvals.s12b;
                    m12x = nvals.m12b;
                    if (outmask & g.GEODESICSCALE) {
                        vals.M12 = nvals.M12;
                        vals.M21 = nvals.M21;
                    }
                    m12x *= this._b;
                    s12x *= this._b;
                    vals.a12 = sig12 / m.degree;
                    if (outmask & g.AREA) {
                        sdomg12 = Math.sin(domg12);
                        cdomg12 = Math.cos(domg12);
                        somg12 = slam12 * cdomg12 - clam12 * sdomg12;
                        comg12 = clam12 * cdomg12 + slam12 * sdomg12;
                    }
                }
            }
            if (outmask & g.DISTANCE)
                vals.s12 = 0 + s12x;
            if (outmask & g.REDUCEDLENGTH)
                vals.m12 = 0 + m12x;
            if (outmask & g.AREA) {
                salp0 = salp1 * cbet1;
                calp0 = m.hypot(calp1, salp1 * sbet1);
                if (calp0 !== 0 && salp0 !== 0) {
                    ssig1 = sbet1;
                    csig1 = calp1 * cbet1;
                    ssig2 = sbet2;
                    csig2 = calp2 * cbet2;
                    k2 = m.sq(calp0) * this._ep2;
                    eps = k2 / (2 * (1 + Math.sqrt(1 + k2)) + k2);
                    A4 = m.sq(this.a) * calp0 * salp0 * this._e2;
                    t = m.hypot(ssig1, csig1);
                    ssig1 /= t;
                    csig1 /= t;
                    t = m.hypot(ssig2, csig2);
                    ssig2 /= t;
                    csig2 /= t;
                    C4a = new Array(g.nC4_);
                    this.C4f(eps, C4a);
                    B41 = g.SinCosSeries(false, ssig1, csig1, C4a);
                    B42 = g.SinCosSeries(false, ssig2, csig2, C4a);
                    vals.S12 = A4 * (B42 - B41);
                } else
                    vals.S12 = 0;
                if (!meridian && somg12 > 1) {
                    somg12 = Math.sin(omg12);
                    comg12 = Math.cos(omg12);
                }
                if (!meridian && comg12 > -0.7071 && sbet2 - sbet1 < 1.75) {
                    domg12 = 1 + comg12;
                    dbet1 = 1 + cbet1;
                    dbet2 = 1 + cbet2;
                    alp12 = 2 * Math.atan2(somg12 * (sbet1 * dbet2 + sbet2 * dbet1), domg12 * (sbet1 * sbet2 + dbet1 * dbet2));
                } else {
                    salp12 = salp2 * calp1 - calp2 * salp1;
                    calp12 = calp2 * calp1 + salp2 * salp1;
                    if (salp12 === 0 && calp12 < 0) {
                        salp12 = g.tiny_ * calp1;
                        calp12 = -1;
                    }
                    alp12 = Math.atan2(salp12, calp12);
                }
                vals.S12 += this._c2 * alp12;
                vals.S12 *= swapp * lonsign * latsign;
                vals.S12 += 0;
            }
            if (swapp < 0) {
                t = salp1;
                salp1 = salp2;
                salp2 = t;
                t = calp1;
                calp1 = calp2;
                calp2 = t;
                if (outmask & g.GEODESICSCALE) {
                    t = vals.M12;
                    vals.M12 = vals.M21;
                    vals.M21 = t;
                }
            }
            salp1 *= swapp * lonsign;
            calp1 *= swapp * latsign;
            salp2 *= swapp * lonsign;
            calp2 *= swapp * latsign;
            return {
                vals: vals,
                salp1: salp1,
                calp1: calp1,
                salp2: salp2,
                calp2: calp2
            };
        }
        ;
        g.Geodesic.prototype.GenDirect = function(lat1, lon1, azi1, arcmode, s12_a12, outmask) {
            var line;
            if (!outmask)
                outmask = g.STANDARD;
            else if (outmask === g.LONG_UNROLL)
                outmask |= g.STANDARD;
            if (!arcmode)
                outmask |= g.DISTANCE_IN;
            line = new l.GeodesicLine(this,lat1,lon1,azi1,outmask);
            return line.GenPosition(arcmode, s12_a12, outmask);
        }
        ;
        g.Geodesic.prototype.Direct = function(lat1, lon1, azi1, s12, outmask) {
            return this.GenDirect(lat1, lon1, azi1, false, s12, outmask);
        }
        ;
        g.Geodesic.prototype.ArcDirect = function(lat1, lon1, azi1, a12, outmask) {
            return this.GenDirect(lat1, lon1, azi1, true, a12, outmask);
        }
        ;
        g.Geodesic.prototype.Line = function(lat1, lon1, azi1, caps) {
            return new l.GeodesicLine(this,lat1,lon1,azi1,caps);
        }
        ;
        g.Geodesic.prototype.DirectLine = function(lat1, lon1, azi1, s12, caps) {
            return this.GenDirectLine(lat1, lon1, azi1, false, s12, caps);
        }
        ;
        g.Geodesic.prototype.ArcDirectLine = function(lat1, lon1, azi1, a12, caps) {
            return this.GenDirectLine(lat1, lon1, azi1, true, a12, caps);
        }
        ;
        g.Geodesic.prototype.GenDirectLine = function(lat1, lon1, azi1, arcmode, s12_a12, caps) {
            var t;
            if (!caps)
                caps = g.STANDARD | g.DISTANCE_IN;
            if (!arcmode)
                caps |= g.DISTANCE_IN;
            t = new l.GeodesicLine(this,lat1,lon1,azi1,caps);
            t.GenSetDistance(arcmode, s12_a12);
            return t;
        }
        ;
        g.Geodesic.prototype.InverseLine = function(lat1, lon1, lat2, lon2, caps) {
            var r, t, azi1;
            if (!caps)
                caps = g.STANDARD | g.DISTANCE_IN;
            r = this.InverseInt(lat1, lon1, lat2, lon2, g.ARC);
            azi1 = m.atan2d(r.salp1, r.calp1);
            if (caps & (g.OUT_MASK & g.DISTANCE_IN))
                caps |= g.DISTANCE;
            t = new l.GeodesicLine(this,lat1,lon1,azi1,caps,r.salp1,r.calp1);
            t.SetArc(r.vals.a12);
            return t;
        }
        ;
        g.Geodesic.prototype.Polygon = function(polyline) {
            return new p.PolygonArea(this,polyline);
        }
        ;
        g.WGS84 = new g.Geodesic(c.WGS84.a,c.WGS84.f);
    }
    )(GeographicLib.Geodesic, GeographicLib.GeodesicLine, GeographicLib.PolygonArea, GeographicLib.Math, GeographicLib.Constants);
    // GeodesicLine.js
    (function(g, l, m) {
        l.GeodesicLine = function(geod, lat1, lon1, azi1, caps, salp1, calp1) {
            var t, cbet1, sbet1, eps, s, c;
            if (!caps)
                caps = g.STANDARD | g.DISTANCE_IN;
            this.a = geod.a;
            this.f = geod.f;
            this._b = geod._b;
            this._c2 = geod._c2;
            this._f1 = geod._f1;
            this.caps = caps | g.LATITUDE | g.AZIMUTH | g.LONG_UNROLL;
            this.lat1 = m.LatFix(lat1);
            this.lon1 = lon1;
            if (typeof salp1 === 'undefined' || typeof calp1 === 'undefined') {
                this.azi1 = m.AngNormalize(azi1);
                t = m.sincosd(m.AngRound(this.azi1));
                this.salp1 = t.s;
                this.calp1 = t.c;
            } else {
                this.azi1 = azi1;
                this.salp1 = salp1;
                this.calp1 = calp1;
            }
            t = m.sincosd(m.AngRound(this.lat1));
            sbet1 = this._f1 * t.s;
            cbet1 = t.c;
            t = m.hypot(sbet1, cbet1);
            sbet1 /= t;
            cbet1 /= t;
            cbet1 = Math.max(g.tiny_, cbet1);
            this._dn1 = Math.sqrt(1 + geod._ep2 * m.sq(sbet1));
            this._salp0 = this.salp1 * cbet1;
            this._calp0 = m.hypot(this.calp1, this.salp1 * sbet1);
            this._ssig1 = sbet1;
            this._somg1 = this._salp0 * sbet1;
            this._csig1 = this._comg1 = sbet1 !== 0 || this.calp1 !== 0 ? cbet1 * this.calp1 : 1;
            t = m.hypot(this._ssig1, this._csig1);
            this._ssig1 /= t;
            this._csig1 /= t;
            this._k2 = m.sq(this._calp0) * geod._ep2;
            eps = this._k2 / (2 * (1 + Math.sqrt(1 + this._k2)) + this._k2);
            if (this.caps & g.CAP_C1) {
                this._A1m1 = g.A1m1f(eps);
                this._C1a = new Array(g.nC1_ + 1);
                g.C1f(eps, this._C1a);
                this._B11 = g.SinCosSeries(true, this._ssig1, this._csig1, this._C1a);
                s = Math.sin(this._B11);
                c = Math.cos(this._B11);
                this._stau1 = this._ssig1 * c + this._csig1 * s;
                this._ctau1 = this._csig1 * c - this._ssig1 * s;
            }
            if (this.caps & g.CAP_C1p) {
                this._C1pa = new Array(g.nC1p_ + 1);
                g.C1pf(eps, this._C1pa);
            }
            if (this.caps & g.CAP_C2) {
                this._A2m1 = g.A2m1f(eps);
                this._C2a = new Array(g.nC2_ + 1);
                g.C2f(eps, this._C2a);
                this._B21 = g.SinCosSeries(true, this._ssig1, this._csig1, this._C2a);
            }
            if (this.caps & g.CAP_C3) {
                this._C3a = new Array(g.nC3_);
                geod.C3f(eps, this._C3a);
                this._A3c = -this.f * this._salp0 * geod.A3f(eps);
                this._B31 = g.SinCosSeries(true, this._ssig1, this._csig1, this._C3a);
            }
            if (this.caps & g.CAP_C4) {
                this._C4a = new Array(g.nC4_);
                geod.C4f(eps, this._C4a);
                this._A4 = m.sq(this.a) * this._calp0 * this._salp0 * geod._e2;
                this._B41 = g.SinCosSeries(false, this._ssig1, this._csig1, this._C4a);
            }
            this.a13 = this.s13 = Number.NaN;
        }
        ;
        l.GeodesicLine.prototype.GenPosition = function(arcmode, s12_a12, outmask) {
            var vals = {}, sig12, ssig12, csig12, B12, AB1, ssig2, csig2, tau12, s, c, serr, omg12, lam12, lon12, E, sbet2, cbet2, somg2, comg2, salp2, calp2, dn2, B22, AB2, J12, t, B42, salp12, calp12;
            if (!outmask)
                outmask = g.STANDARD;
            else if (outmask === g.LONG_UNROLL)
                outmask |= g.STANDARD;
            outmask &= this.caps & g.OUT_MASK;
            vals.lat1 = this.lat1;
            vals.azi1 = this.azi1;
            vals.lon1 = outmask & g.LONG_UNROLL ? this.lon1 : m.AngNormalize(this.lon1);
            if (arcmode)
                vals.a12 = s12_a12;
            else
                vals.s12 = s12_a12;
            if (!(arcmode || (this.caps & g.DISTANCE_IN & g.OUT_MASK))) {
                vals.a12 = Number.NaN;
                return vals;
            }
            B12 = 0;
            AB1 = 0;
            if (arcmode) {
                sig12 = s12_a12 * m.degree;
                t = m.sincosd(s12_a12);
                ssig12 = t.s;
                csig12 = t.c;
            } else {
                tau12 = s12_a12 / (this._b * (1 + this._A1m1));
                s = Math.sin(tau12);
                c = Math.cos(tau12);
                B12 = -g.SinCosSeries(true, this._stau1 * c + this._ctau1 * s, this._ctau1 * c - this._stau1 * s, this._C1pa);
                sig12 = tau12 - (B12 - this._B11);
                ssig12 = Math.sin(sig12);
                csig12 = Math.cos(sig12);
                if (Math.abs(this.f) > 0.01) {
                    ssig2 = this._ssig1 * csig12 + this._csig1 * ssig12;
                    csig2 = this._csig1 * csig12 - this._ssig1 * ssig12;
                    B12 = g.SinCosSeries(true, ssig2, csig2, this._C1a);
                    serr = (1 + this._A1m1) * (sig12 + (B12 - this._B11)) - s12_a12 / this._b;
                    sig12 = sig12 - serr / Math.sqrt(1 + this._k2 * m.sq(ssig2));
                    ssig12 = Math.sin(sig12);
                    csig12 = Math.cos(sig12);
                }
            }
            ssig2 = this._ssig1 * csig12 + this._csig1 * ssig12;
            csig2 = this._csig1 * csig12 - this._ssig1 * ssig12;
            dn2 = Math.sqrt(1 + this._k2 * m.sq(ssig2));
            if (outmask & (g.DISTANCE | g.REDUCEDLENGTH | g.GEODESICSCALE)) {
                if (arcmode || Math.abs(this.f) > 0.01)
                    B12 = g.SinCosSeries(true, ssig2, csig2, this._C1a);
                AB1 = (1 + this._A1m1) * (B12 - this._B11);
            }
            sbet2 = this._calp0 * ssig2;
            cbet2 = m.hypot(this._salp0, this._calp0 * csig2);
            if (cbet2 === 0)
                cbet2 = csig2 = g.tiny_;
            salp2 = this._salp0;
            calp2 = this._calp0 * csig2;
            if (arcmode && (outmask & g.DISTANCE))
                vals.s12 = this._b * ((1 + this._A1m1) * sig12 + AB1);
            if (outmask & g.LONGITUDE) {
                somg2 = this._salp0 * ssig2;
                comg2 = csig2;
                E = m.copysign(1, this._salp0);
                omg12 = outmask & g.LONG_UNROLL ? E * (sig12 - (Math.atan2(ssig2, csig2) - Math.atan2(this._ssig1, this._csig1)) + (Math.atan2(E * somg2, comg2) - Math.atan2(E * this._somg1, this._comg1))) : Math.atan2(somg2 * this._comg1 - comg2 * this._somg1, comg2 * this._comg1 + somg2 * this._somg1);
                lam12 = omg12 + this._A3c * (sig12 + (g.SinCosSeries(true, ssig2, csig2, this._C3a) - this._B31));
                lon12 = lam12 / m.degree;
                vals.lon2 = outmask & g.LONG_UNROLL ? this.lon1 + lon12 : m.AngNormalize(m.AngNormalize(this.lon1) + m.AngNormalize(lon12));
            }
            if (outmask & g.LATITUDE)
                vals.lat2 = m.atan2d(sbet2, this._f1 * cbet2);
            if (outmask & g.AZIMUTH)
                vals.azi2 = m.atan2d(salp2, calp2);
            if (outmask & (g.REDUCEDLENGTH | g.GEODESICSCALE)) {
                B22 = g.SinCosSeries(true, ssig2, csig2, this._C2a);
                AB2 = (1 + this._A2m1) * (B22 - this._B21);
                J12 = (this._A1m1 - this._A2m1) * sig12 + (AB1 - AB2);
                if (outmask & g.REDUCEDLENGTH)
                    vals.m12 = this._b * ((dn2 * (this._csig1 * ssig2) - this._dn1 * (this._ssig1 * csig2)) - this._csig1 * csig2 * J12);
                if (outmask & g.GEODESICSCALE) {
                    t = this._k2 * (ssig2 - this._ssig1) * (ssig2 + this._ssig1) / (this._dn1 + dn2);
                    vals.M12 = csig12 + (t * ssig2 - csig2 * J12) * this._ssig1 / this._dn1;
                    vals.M21 = csig12 - (t * this._ssig1 - this._csig1 * J12) * ssig2 / dn2;
                }
            }
            if (outmask & g.AREA) {
                B42 = g.SinCosSeries(false, ssig2, csig2, this._C4a);
                if (this._calp0 === 0 || this._salp0 === 0) {
                    salp12 = salp2 * this.calp1 - calp2 * this.salp1;
                    calp12 = calp2 * this.calp1 + salp2 * this.salp1;
                } else {
                    salp12 = this._calp0 * this._salp0 * (csig12 <= 0 ? this._csig1 * (1 - csig12) + ssig12 * this._ssig1 : ssig12 * (this._csig1 * ssig12 / (1 + csig12) + this._ssig1));
                    calp12 = m.sq(this._salp0) + m.sq(this._calp0) * this._csig1 * csig2;
                }
                vals.S12 = this._c2 * Math.atan2(salp12, calp12) + this._A4 * (B42 - this._B41);
            }
            if (!arcmode)
                vals.a12 = sig12 / m.degree;
            return vals;
        }
        ;
        l.GeodesicLine.prototype.Position = function(s12, outmask) {
            return this.GenPosition(false, s12, outmask);
        }
        ;
        l.GeodesicLine.prototype.ArcPosition = function(a12, outmask) {
            return this.GenPosition(true, a12, outmask);
        }
        ;
        l.GeodesicLine.prototype.GenSetDistance = function(arcmode, s13_a13) {
            if (arcmode)
                this.SetArc(s13_a13);
            else
                this.SetDistance(s13_a13);
        }
        ;
        l.GeodesicLine.prototype.SetDistance = function(s13) {
            var r;
            this.s13 = s13;
            r = this.GenPosition(false, this.s13, g.ARC);
            this.a13 = 0 + r.a12;
        }
        ;
        l.GeodesicLine.prototype.SetArc = function(a13) {
            var r;
            this.a13 = a13;
            r = this.GenPosition(true, this.a13, g.DISTANCE);
            this.s13 = 0 + r.s12;
        }
        ;
    }
    )(GeographicLib.Geodesic, GeographicLib.GeodesicLine, GeographicLib.Math);
    // PolygonArea.js
    (function(p, g, m, a) {
        var transit, transitdirect, AreaReduceA, AreaReduceB;
        transit = function(lon1, lon2) {
            var lon12, cross;
            lon1 = m.AngNormalize(lon1);
            lon2 = m.AngNormalize(lon2);
            lon12 = m.AngDiff(lon1, lon2).s;
            cross = lon1 <= 0 && lon2 > 0 && lon12 > 0 ? 1 : (lon2 <= 0 && lon1 > 0 && lon12 < 0 ? -1 : 0);
            return cross;
        }
        ;
        transitdirect = function(lon1, lon2) {
            lon1 = lon1 % 720.0;
            lon2 = lon2 % 720.0;
            return (((lon2 <= 0 && lon2 > -360) || lon2 > 360 ? 1 : 0) - ((lon1 <= 0 && lon1 > -360) || lon1 > 360 ? 1 : 0));
        }
        ;
        AreaReduceA = function(area, area0, crossings, reverse, sign) {
            area.Remainder(area0);
            if (crossings & 1)
                area.Add((area.Sum() < 0 ? 1 : -1) * area0 / 2);
            if (!reverse)
                area.Negate();
            if (sign) {
                if (area.Sum() > area0 / 2)
                    area.Add(-area0);
                else if (area.Sum() <= -area0 / 2)
                    area.Add(+area0);
            } else {
                if (area.Sum() >= area0)
                    area.Add(-area0);
                else if (area.Sum() < 0)
                    area.Add(+area0);
            }
            return 0 + area.Sum();
        }
        ;
        AreaReduceB = function(area, area0, crossings, reverse, sign) {
            area = m.remainder(area, area0);
            if (crossings & 1)
                area += (area < 0 ? 1 : -1) * area0 / 2;
            if (!reverse)
                area *= -1;
            if (sign) {
                if (area > area0 / 2)
                    area -= area0;
                else if (area <= -area0 / 2)
                    area += area0;
            } else {
                if (area >= area0)
                    area -= area0;
                else if (area < 0)
                    area += area0;
            }
            return 0 + area;
        }
        ;
        p.PolygonArea = function(geod, polyline) {
            this._geod = geod;
            this.a = this._geod.a;
            this.f = this._geod.f;
            this._area0 = 4 * Math.PI * geod._c2;
            this.polyline = !polyline ? false : polyline;
            this._mask = g.LATITUDE | g.LONGITUDE | g.DISTANCE | (this.polyline ? g.NONE : g.AREA | g.LONG_UNROLL);
            if (!this.polyline)
                this._areasum = new a.Accumulator(0);
            this._perimetersum = new a.Accumulator(0);
            this.Clear();
        }
        ;
        p.PolygonArea.prototype.Clear = function() {
            this.num = 0;
            this._crossings = 0;
            if (!this.polyline)
                this._areasum.Set(0);
            this._perimetersum.Set(0);
            this._lat0 = this._lon0 = this.lat = this.lon = Number.NaN;
        }
        ;
        p.PolygonArea.prototype.AddPoint = function(lat, lon) {
            var t;
            if (this.num === 0) {
                this._lat0 = this.lat = lat;
                this._lon0 = this.lon = lon;
            } else {
                t = this._geod.Inverse(this.lat, this.lon, lat, lon, this._mask);
                this._perimetersum.Add(t.s12);
                if (!this.polyline) {
                    this._areasum.Add(t.S12);
                    this._crossings += transit(this.lon, lon);
                }
                this.lat = lat;
                this.lon = lon;
            }
            ++this.num;
        }
        ;
        p.PolygonArea.prototype.AddEdge = function(azi, s) {
            var t;
            if (this.num) {
                t = this._geod.Direct(this.lat, this.lon, azi, s, this._mask);
                this._perimetersum.Add(s);
                if (!this.polyline) {
                    this._areasum.Add(t.S12);
                    this._crossings += transitdirect(this.lon, t.lon2);
                }
                this.lat = t.lat2;
                this.lon = t.lon2;
            }
            ++this.num;
        }
        ;
        p.PolygonArea.prototype.Compute = function(reverse, sign) {
            var vals = {
                number: this.num
            }, t, tempsum;
            if (this.num < 2) {
                vals.perimeter = 0;
                if (!this.polyline)
                    vals.area = 0;
                return vals;
            }
            if (this.polyline) {
                vals.perimeter = this._perimetersum.Sum();
                return vals;
            }
            t = this._geod.Inverse(this.lat, this.lon, this._lat0, this._lon0, this._mask);
            vals.perimeter = this._perimetersum.Sum(t.s12);
            tempsum = new a.Accumulator(this._areasum);
            tempsum.Add(t.S12);
            vals.area = AreaReduceA(tempsum, this._area0, this._crossings + transit(this.lon, this._lon0), reverse, sign);
            return vals;
        }
        ;
        p.PolygonArea.prototype.TestPoint = function(lat, lon, reverse, sign) {
            var vals = {
                number: this.num + 1
            }, t, tempsum, crossings, i;
            if (this.num === 0) {
                vals.perimeter = 0;
                if (!this.polyline)
                    vals.area = 0;
                return vals;
            }
            vals.perimeter = this._perimetersum.Sum();
            tempsum = this.polyline ? 0 : this._areasum.Sum();
            crossings = this._crossings;
            for (i = 0; i < (this.polyline ? 1 : 2); ++i) {
                t = this._geod.Inverse(i === 0 ? this.lat : lat, i === 0 ? this.lon : lon, i !== 0 ? this._lat0 : lat, i !== 0 ? this._lon0 : lon, this._mask);
                vals.perimeter += t.s12;
                if (!this.polyline) {
                    tempsum += t.S12;
                    crossings += transit(i === 0 ? this.lon : lon, i !== 0 ? this._lon0 : lon);
                }
            }
            if (this.polyline)
                return vals;
            vals.area = AreaReduceB(tempsum, this._area0, crossings, reverse, sign);
            return vals;
        }
        ;
        p.PolygonArea.prototype.TestEdge = function(azi, s, reverse, sign) {
            var vals = {
                number: this.num ? this.num + 1 : 0
            }, t, tempsum, crossings;
            if (this.num === 0)
                return vals;
            vals.perimeter = this._perimetersum.Sum() + s;
            if (this.polyline)
                return vals;
            tempsum = this._areasum.Sum();
            crossings = this._crossings;
            t = this._geod.Direct(this.lat, this.lon, azi, s, this._mask);
            tempsum += t.S12;
            crossings += transitdirect(this.lon, t.lon2);
            crossings += transit(t.lon2, this._lon0);
            t = this._geod.Inverse(t.lat2, t.lon2, this._lat0, this._lon0, this._mask);
            vals.perimeter += t.s12;
            tempsum += t.S12;
            vals.area = AreaReduceB(tempsum, this._area0, crossings, reverse, sign);
            return vals;
        }
        ;
    }
    )(GeographicLib.PolygonArea, GeographicLib.Geodesic, GeographicLib.Math, GeographicLib.Accumulator);
    // DMS.js
    GeographicLib.DMS = {};
    (function(d) {
        var lookup, zerofill, internalDecode, numMatch, hemispheres_ = "SNWE", signs_ = "-+", digits_ = "0123456789", dmsindicators_ = "D'\":", dmsindicatorsu_ = "\u00b0'\"", components_ = ["degrees", "minutes", "seconds"];
        lookup = function(s, c) {
            return s.indexOf(c.toUpperCase());
        }
        ;
        zerofill = function(s, n) {
            return String("0000").substr(0, Math.max(0, Math.min(4, n - s.length))) + s;
        }
        ;
        d.NONE = 0;
        d.LATITUDE = 1;
        d.LONGITUDE = 2;
        d.AZIMUTH = 3;
        d.DEGREE = 0;
        d.MINUTE = 1;
        d.SECOND = 2;
        d.Decode = function(dms) {
            var dmsa = dms, end, v = 0, i = 0, mi, pi, vals, ind1 = d.NONE, ind2, p, pa, pb;
            dmsa = dmsa.replace(/\u2212/g, '-').replace(/\u00b0/g, 'd').replace(/\u00ba/g, 'd').replace(/\u2070/g, 'd').replace(/\u02da/g, 'd').replace(/\u2032/g, '\'').replace(/\u00b4/g, '\'').replace(/\u2019/g, '\'').replace(/\u2033/g, '"').replace(/\u201d/g, '"').replace(/\u00a0/g, '').replace(/\u202f/g, '').replace(/\u2007/g, '').replace(/''/g, '"').trim();
            end = dmsa.length;
            for (p = 0; p < end; p = pb,
            ++i) {
                pa = p;
                if (i === 0 && lookup(hemispheres_, dmsa.charAt(pa)) >= 0)
                    ++pa;
                if (i > 0 || (pa < end && lookup(signs_, dmsa.charAt(pa)) >= 0))
                    ++pa;
                mi = dmsa.substr(pa, end - pa).indexOf('-');
                pi = dmsa.substr(pa, end - pa).indexOf('+');
                if (mi < 0)
                    mi = end;
                else
                    mi += pa;
                if (pi < 0)
                    pi = end;
                else
                    pi += pa;
                pb = Math.min(mi, pi);
                vals = internalDecode(dmsa.substr(p, pb - p));
                v += vals.val;
                ind2 = vals.ind;
                if (ind1 === d.NONE)
                    ind1 = ind2;
                else if (!(ind2 === d.NONE || ind1 === ind2))
                    throw new Error("Incompatible hemisphere specifies in " + dmsa.substr(0, pb));
            }
            if (i === 0)
                throw new Error("Empty or incomplete DMS string " + dmsa);
            return {
                val: v,
                ind: ind1
            };
        }
        ;
        internalDecode = function(dmsa) {
            var vals = {}, errormsg = "", sign, beg, end, ind1, k, ipieces, fpieces, npiece, icurrent, fcurrent, ncurrent, p, pointseen, digcount, intcount, x;
            do {
                sign = 1;
                beg = 0;
                end = dmsa.length;
                ind1 = d.NONE;
                k = -1;
                if (end > beg && (k = lookup(hemispheres_, dmsa.charAt(beg))) >= 0) {
                    ind1 = (k & 2) ? d.LONGITUDE : d.LATITUDE;
                    sign = (k & 1) ? 1 : -1;
                    ++beg;
                }
                if (end > beg && (k = lookup(hemispheres_, dmsa.charAt(end - 1))) >= 0) {
                    if (k >= 0) {
                        if (ind1 !== d.NONE) {
                            if (dmsa.charAt(beg - 1).toUpperCase() === dmsa.charAt(end - 1).toUpperCase())
                                errormsg = "Repeated hemisphere indicators " + dmsa.charAt(beg - 1) + " in " + dmsa.substr(beg - 1, end - beg + 1);
                            else
                                errormsg = "Contradictory hemisphere indicators " + dmsa.charAt(beg - 1) + " and " + dmsa.charAt(end - 1) + " in " + dmsa.substr(beg - 1, end - beg + 1);
                            break;
                        }
                        ind1 = (k & 2) ? d.LONGITUDE : d.LATITUDE;
                        sign = (k & 1) ? 1 : -1;
                        --end;
                    }
                }
                if (end > beg && (k = lookup(signs_, dmsa.charAt(beg))) >= 0) {
                    if (k >= 0) {
                        sign *= k ? 1 : -1;
                        ++beg;
                    }
                }
                if (end === beg) {
                    errormsg = "Empty or incomplete DMS string " + dmsa;
                    break;
                }
                ipieces = [0, 0, 0];
                fpieces = [0, 0, 0];
                npiece = 0;
                icurrent = 0;
                fcurrent = 0;
                ncurrent = 0;
                p = beg;
                pointseen = false;
                digcount = 0;
                intcount = 0;
                while (p < end) {
                    x = dmsa.charAt(p++);
                    if ((k = lookup(digits_, x)) >= 0) {
                        ++ncurrent;
                        if (digcount > 0) {
                            ++digcount;
                        } else {
                            icurrent = 10 * icurrent + k;
                            ++intcount;
                        }
                    } else if (x === '.') {
                        if (pointseen) {
                            errormsg = "Multiple decimal points in " + dmsa.substr(beg, end - beg);
                            break;
                        }
                        pointseen = true;
                        digcount = 1;
                    } else if ((k = lookup(dmsindicators_, x)) >= 0) {
                        if (k >= 3) {
                            if (p === end) {
                                errormsg = "Illegal for colon to appear at the end of " + dmsa.substr(beg, end - beg);
                                break;
                            }
                            k = npiece;
                        }
                        if (k === npiece - 1) {
                            errormsg = "Repeated " + components_[k] + " component in " + dmsa.substr(beg, end - beg);
                            break;
                        } else if (k < npiece) {
                            errormsg = components_[k] + " component follows " + components_[npiece - 1] + " component in " + dmsa.substr(beg, end - beg);
                            break;
                        }
                        if (ncurrent === 0) {
                            errormsg = "Missing numbers in " + components_[k] + " component of " + dmsa.substr(beg, end - beg);
                            break;
                        }
                        if (digcount > 0) {
                            fcurrent = parseFloat(dmsa.substr(p - intcount - digcount - 1, intcount + digcount));
                            icurrent = 0;
                        }
                        ipieces[k] = icurrent;
                        fpieces[k] = icurrent + fcurrent;
                        if (p < end) {
                            npiece = k + 1;
                            icurrent = fcurrent = 0;
                            ncurrent = digcount = intcount = 0;
                        }
                    } else if (lookup(signs_, x) >= 0) {
                        errormsg = "Internal sign in DMS string " + dmsa.substr(beg, end - beg);
                        break;
                    } else {
                        errormsg = "Illegal character " + x + " in DMS string " + dmsa.substr(beg, end - beg);
                        break;
                    }
                }
                if (errormsg.length)
                    break;
                if (lookup(dmsindicators_, dmsa.charAt(p - 1)) < 0) {
                    if (npiece >= 3) {
                        errormsg = "Extra text following seconds in DMS string " + dmsa.substr(beg, end - beg);
                        break;
                    }
                    if (ncurrent === 0) {
                        errormsg = "Missing numbers in trailing component of " + dmsa.substr(beg, end - beg);
                        break;
                    }
                    if (digcount > 0) {
                        fcurrent = parseFloat(dmsa.substr(p - intcount - digcount, intcount + digcount));
                        icurrent = 0;
                    }
                    ipieces[npiece] = icurrent;
                    fpieces[npiece] = icurrent + fcurrent;
                }
                if (pointseen && digcount === 0) {
                    errormsg = "Decimal point in non-terminal component of " + dmsa.substr(beg, end - beg);
                    break;
                }
                if (ipieces[1] >= 60 || fpieces[1] > 60) {
                    errormsg = "Minutes " + fpieces[1] + " not in range [0,60)";
                    break;
                }
                if (ipieces[2] >= 60 || fpieces[2] > 60) {
                    errormsg = "Seconds " + fpieces[2] + " not in range [0,60)";
                    break;
                }
                vals.ind = ind1;
                vals.val = sign * (fpieces[2] ? (60 * (60 * fpieces[0] + fpieces[1]) + fpieces[2]) / 3600 : (fpieces[1] ? (60 * fpieces[0] + fpieces[1]) / 60 : fpieces[0]));
                return vals;
            } while (false);
            vals.val = numMatch(dmsa);
            if (vals.val === 0)
                throw new Error(errormsg);
            else
                vals.ind = d.NONE;
            return vals;
        }
        ;
        numMatch = function(s) {
            var t, sign, p0, p1;
            if (s.length < 3)
                return 0;
            t = s.toUpperCase().replace(/0+$/, "");
            sign = t.charAt(0) === '-' ? -1 : 1;
            p0 = t.charAt(0) === '-' || t.charAt(0) === '+' ? 1 : 0;
            p1 = t.length - 1;
            if (p1 + 1 < p0 + 3)
                return 0;
            t = t.substr(p0, p1 + 1 - p0);
            if (t === "NAN" || t === "1.#QNAN" || t === "1.#SNAN" || t === "1.#IND" || t === "1.#R")
                return Number.NaN;
            else if (t === "INF" || t === "1.#INF")
                return sign * Number.POSITIVE_INFINITY;
            return 0;
        }
        ;
        d.DecodeLatLon = function(stra, strb, longfirst) {
            var vals = {}, valsa = d.Decode(stra), valsb = d.Decode(strb), a = valsa.val, ia = valsa.ind, b = valsb.val, ib = valsb.ind, lat, lon;
            if (!longfirst)
                longfirst = false;
            if (ia === d.NONE && ib === d.NONE) {
                ia = longfirst ? d.LONGITUDE : d.LATITUDE;
                ib = longfirst ? d.LATITUDE : d.LONGITUDE;
            } else if (ia === d.NONE)
                ia = d.LATITUDE + d.LONGITUDE - ib;
            else if (ib === d.NONE)
                ib = d.LATITUDE + d.LONGITUDE - ia;
            if (ia === ib)
                throw new Error("Both " + stra + " and " + strb + " interpreted as " + (ia === d.LATITUDE ? "latitudes" : "longitudes"));
            lat = ia === d.LATITUDE ? a : b;
            lon = ia === d.LATITUDE ? b : a;
            if (Math.abs(lat) > 90)
                throw new Error("Latitude " + lat + " not in [-90,90]");
            vals.lat = lat;
            vals.lon = lon;
            return vals;
        }
        ;
        d.DecodeAngle = function(angstr) {
            var vals = d.Decode(angstr)
              , ang = vals.val
              , ind = vals.ind;
            if (ind !== d.NONE)
                throw new Error("Arc angle " + angstr + " includes a hemisphere N/E/W/S");
            return ang;
        }
        ;
        d.DecodeAzimuth = function(azistr) {
            var vals = d.Decode(azistr)
              , azi = vals.val
              , ind = vals.ind;
            if (ind === d.LATITUDE)
                throw new Error("Azimuth " + azistr + " has a latitude hemisphere N/S");
            return azi;
        }
        ;
        d.Encode = function(angle, trailing, prec, ind) {
            var scale = 1, i, sign, idegree, fdegree, f, pieces, ip, fp, s;
            if (!ind)
                ind = d.NONE;
            if (!isFinite(angle))
                return angle < 0 ? String("-inf") : (angle > 0 ? String("inf") : String("nan"));
            prec = Math.min(15 - 2 * trailing, prec);
            for (i = 0; i < trailing; ++i)
                scale *= 60;
            for (i = 0; i < prec; ++i)
                scale *= 10;
            if (ind === d.AZIMUTH)
                angle -= Math.floor(angle / 360) * 360;
            sign = angle < 0 ? -1 : 1;
            angle *= sign;
            idegree = Math.floor(angle);
            fdegree = (angle - idegree) * scale + 0.5;
            f = Math.floor(fdegree);
            fdegree = (f === fdegree && (f & 1) === 1) ? f - 1 : f;
            fdegree /= scale;
            fdegree = Math.floor((angle - idegree) * scale + 0.5) / scale;
            if (fdegree >= 1) {
                idegree += 1;
                fdegree -= 1;
            }
            pieces = [fdegree, 0, 0];
            for (i = 1; i <= trailing; ++i) {
                ip = Math.floor(pieces[i - 1]);
                fp = pieces[i - 1] - ip;
                pieces[i] = fp * 60;
                pieces[i - 1] = ip;
            }
            pieces[0] += idegree;
            s = "";
            if (ind === d.NONE && sign < 0)
                s += '-';
            switch (trailing) {
            case d.DEGREE:
                s += zerofill(pieces[0].toFixed(prec), ind === d.NONE ? 0 : 1 + Math.min(ind, 2) + prec + (prec ? 1 : 0)) + dmsindicatorsu_.charAt(0);
                break;
            default:
                s += zerofill(pieces[0].toFixed(0), ind === d.NONE ? 0 : 1 + Math.min(ind, 2)) + dmsindicatorsu_.charAt(0);
                switch (trailing) {
                case d.MINUTE:
                    s += zerofill(pieces[1].toFixed(prec), 2 + prec + (prec ? 1 : 0)) + dmsindicatorsu_.charAt(1);
                    break;
                case d.SECOND:
                    s += zerofill(pieces[1].toFixed(0), 2) + dmsindicatorsu_.charAt(1);
                    s += zerofill(pieces[2].toFixed(prec), 2 + prec + (prec ? 1 : 0)) + dmsindicatorsu_.charAt(2);
                    break;
                default:
                    break;
                }
            }
            if (ind !== d.NONE && ind !== d.AZIMUTH)
                s += hemispheres_.charAt((ind === d.LATITUDE ? 0 : 2) + (sign < 0 ? 0 : 1));
            return s;
        }
        ;
    }
    )(GeographicLib.DMS);
    cb(GeographicLib);
}
)(function(geo) {
    if (typeof module === 'object' && module.exports) {
        module.exports = geo;
    } else if (typeof define === 'function' && define.amd) {
        define('geographiclib', [], function() {
            return geo;
        });
    } else {
        window.GeographicLib = geo;
    }
});

(function() {
    "use strict";
    var PI = Math.PI
      , sin = Math.sin
      , cos = Math.cos
      , tan = Math.tan
      , asin = Math.asin
      , atan = Math.atan2
      , acos = Math.acos
      , rad = PI / 180;
    var dayMs = 1e3 * 60 * 60 * 24
      , J1970 = 2440588
      , J2000 = 2451545;
    function toJulian(date) {
        return date.valueOf() / dayMs - .5 + J1970
    }
    function fromJulian(j) {
        return new Date((j + .5 - J1970) * dayMs)
    }
    function toDays(date) {
        return toJulian(date) - J2000
    }
    var e = rad * 23.4397;
    function rightAscension(l, b) {
        return atan(sin(l) * cos(e) - tan(b) * sin(e), cos(l))
    }
    function declination(l, b) {
        return asin(sin(b) * cos(e) + cos(b) * sin(e) * sin(l))
    }
    function azimuth(H, phi, dec) {
        return atan(sin(H), cos(H) * sin(phi) - tan(dec) * cos(phi))
    }
    function altitude(H, phi, dec) {
        return asin(sin(phi) * sin(dec) + cos(phi) * cos(dec) * cos(H))
    }
    function siderealTime(d, lw) {
        return rad * (280.16 + 360.9856235 * d) - lw
    }
    function astroRefraction(h) {
        if (h < 0)
            h = 0;
        return 2967e-7 / Math.tan(h + .00312536 / (h + .08901179))
    }
    function solarMeanAnomaly(d) {
        return rad * (357.5291 + .98560028 * d)
    }
    function eclipticLongitude(M) {
        var C = rad * (1.9148 * sin(M) + .02 * sin(2 * M) + 3e-4 * sin(3 * M))
          , P = rad * 102.9372;
        return M + C + P + PI
    }
    function sunCoords(d) {
        var M = solarMeanAnomaly(d)
          , L = eclipticLongitude(M);
        return {
            dec: declination(L, 0),
            ra: rightAscension(L, 0)
        }
    }
    var SunCalc = {};
    SunCalc.getPosition = function(date, lat, lng) {
        var lw = rad * -lng
          , phi = rad * lat
          , d = toDays(date)
          , c = sunCoords(d)
          , H = siderealTime(d, lw) - c.ra;
        return {
            azimuth: azimuth(H, phi, c.dec),
            altitude: altitude(H, phi, c.dec)
        }
    }
    ;
    var times = SunCalc.times = [[-.833, "sunrise", "sunset"], [-.3, "sunriseEnd", "sunsetStart"], [-6, "dawn", "dusk"], [-12, "nauticalDawn", "nauticalDusk"], [-18, "nightEnd", "night"], [6, "goldenHourEnd", "goldenHour"]];
    SunCalc.addTime = function(angle, riseName, setName) {
        times.push([angle, riseName, setName])
    }
    ;
    var J0 = 9e-4;
    function julianCycle(d, lw) {
        return Math.round(d - J0 - lw / (2 * PI))
    }
    function approxTransit(Ht, lw, n) {
        return J0 + (Ht + lw) / (2 * PI) + n
    }
    function solarTransitJ(ds, M, L) {
        return J2000 + ds + .0053 * sin(M) - .0069 * sin(2 * L)
    }
    function hourAngle(h, phi, d) {
        return acos((sin(h) - sin(phi) * sin(d)) / (cos(phi) * cos(d)))
    }
    function observerAngle(height) {
        return -2.076 * Math.sqrt(height) / 60
    }
    function getSetJ(h, lw, phi, dec, n, M, L) {
        var w = hourAngle(h, phi, dec)
          , a = approxTransit(w, lw, n);
        return solarTransitJ(a, M, L)
    }
    SunCalc.getTimes = function(date, lat, lng, height) {
        height = height || 0;
        var lw = rad * -lng, phi = rad * lat, dh = observerAngle(height), d = toDays(date), n = julianCycle(d, lw), ds = approxTransit(0, lw, n), M = solarMeanAnomaly(ds), L = eclipticLongitude(M), dec = declination(L, 0), Jnoon = solarTransitJ(ds, M, L), i, len, time, h0, Jset, Jrise;
        var result = {
            solarNoon: fromJulian(Jnoon),
            nadir: fromJulian(Jnoon - .5)
        };
        for (i = 0,
        len = times.length; i < len; i += 1) {
            time = times[i];
            h0 = (time[0] + dh) * rad;
            Jset = getSetJ(h0, lw, phi, dec, n, M, L);
            Jrise = Jnoon - (Jset - Jnoon);
            result[time[1]] = fromJulian(Jrise);
            result[time[2]] = fromJulian(Jset)
        }
        return result
    }
    ;
    function moonCoords(d) {
        var L = rad * (218.316 + 13.176396 * d)
          , M = rad * (134.963 + 13.064993 * d)
          , F = rad * (93.272 + 13.22935 * d)
          , l = L + rad * 6.289 * sin(M)
          , b = rad * 5.128 * sin(F)
          , dt = 385001 - 20905 * cos(M);
        return {
            ra: rightAscension(l, b),
            dec: declination(l, b),
            dist: dt
        }
    }
    SunCalc.getMoonPosition = function(date, lat, lng) {
        var lw = rad * -lng
          , phi = rad * lat
          , d = toDays(date)
          , c = moonCoords(d)
          , H = siderealTime(d, lw) - c.ra
          , h = altitude(H, phi, c.dec)
          , pa = atan(sin(H), tan(phi) * cos(c.dec) - sin(c.dec) * cos(H));
        h = h + astroRefraction(h);
        return {
            azimuth: azimuth(H, phi, c.dec),
            altitude: h,
            distance: c.dist,
            parallacticAngle: pa
        }
    }
    ;
    SunCalc.getMoonIllumination = function(date) {
        var d = toDays(date || new Date)
          , s = sunCoords(d)
          , m = moonCoords(d)
          , sdist = 149598e3
          , phi = acos(sin(s.dec) * sin(m.dec) + cos(s.dec) * cos(m.dec) * cos(s.ra - m.ra))
          , inc = atan(sdist * sin(phi), m.dist - sdist * cos(phi))
          , angle = atan(cos(s.dec) * sin(s.ra - m.ra), sin(s.dec) * cos(m.dec) - cos(s.dec) * sin(m.dec) * cos(s.ra - m.ra));
        return {
            fraction: (1 + cos(inc)) / 2,
            phase: .5 + .5 * inc * (angle < 0 ? -1 : 1) / Math.PI,
            angle: angle
        }
    }
    ;
    function hoursLater(date, h) {
        return new Date(date.valueOf() + h * dayMs / 24)
    }
    SunCalc.getMoonTimes = function(date, lat, lng, inUTC) {
        var t = new Date(date);
        if (inUTC)
            t.setUTCHours(0, 0, 0, 0);
        else
            t.setHours(0, 0, 0, 0);
        var hc = .133 * rad, h0 = SunCalc.getMoonPosition(t, lat, lng).altitude - hc, h1, h2, rise, set, a, b, xe, ye, d, roots, x1, x2, dx;
        for (var i = 1; i <= 24; i += 2) {
            h1 = SunCalc.getMoonPosition(hoursLater(t, i), lat, lng).altitude - hc;
            h2 = SunCalc.getMoonPosition(hoursLater(t, i + 1), lat, lng).altitude - hc;
            a = (h0 + h2) / 2 - h1;
            b = (h2 - h0) / 2;
            xe = -b / (2 * a);
            ye = (a * xe + b) * xe + h1;
            d = b * b - 4 * a * h1;
            roots = 0;
            if (d >= 0) {
                dx = Math.sqrt(d) / (Math.abs(a) * 2);
                x1 = xe - dx;
                x2 = xe + dx;
                if (Math.abs(x1) <= 1)
                    roots++;
                if (Math.abs(x2) <= 1)
                    roots++;
                if (x1 < -1)
                    x1 = x2
            }
            if (roots === 1) {
                if (h0 < 0)
                    rise = i + x1;
                else
                    set = i + x1
            } else if (roots === 2) {
                rise = i + (ye < 0 ? x2 : x1);
                set = i + (ye < 0 ? x1 : x2)
            }
            if (rise && set)
                break;
            h0 = h2
        }
        var result = {};
        if (rise)
            result.rise = hoursLater(t, rise);
        if (set)
            result.set = hoursLater(t, set);
        if (!rise && !set)
            result[ye > 0 ? "alwaysUp" : "alwaysDown"] = true;
        return result
    }
    ;
    if (typeof exports === "object" && typeof module !== "undefined")
        module.exports = SunCalc;
    else if (typeof define === "function" && define.amd)
        define(SunCalc);
    else
        window.SunCalc = SunCalc
}
)();

d3 = function() {
    function n(n) {
        return null != n && !isNaN(n)
    }
    function t(n) {
        return n.length
    }
    function e(n) {
        for (var t = 1; n * t % 1; )
            t *= 10;
        return t
    }
    function r(n, t) {
        try {
            for (var e in t)
                Object.defineProperty(n.prototype, e, {
                    value: t[e],
                    enumerable: !1
                })
        } catch (r) {
            n.prototype = t
        }
    }
    function u() {}
    function i() {}
    function o(n, t, e) {
        return function() {
            var r = e.apply(t, arguments);
            return r === t ? n : r
        }
    }
    function a(n, t) {
        if (t in n)
            return t;
        t = t.charAt(0).toUpperCase() + t.substring(1);
        for (var e = 0, r = fa.length; r > e; ++e) {
            var u = fa[e] + t;
            if (u in n)
                return u
        }
    }
    function c() {}
    function s() {}
    function l(n) {
        function t() {
            for (var t, r = e, u = -1, i = r.length; ++u < i; )
                (t = r[u].on) && t.apply(this, arguments);
            return n
        }
        var e = []
          , r = new u;
        return t.on = function(t, u) {
            var i, o = r.get(t);
            return arguments.length < 2 ? o && o.on : (o && (o.on = null,
            e = e.slice(0, i = e.indexOf(o)).concat(e.slice(i + 1)),
            r.remove(t)),
            u && e.push(r.set(t, {
                on: u
            })),
            n)
        }
        ,
        t
    }
    function f() {
        Bo.event.preventDefault()
    }
    function h() {
        for (var n, t = Bo.event; n = t.sourceEvent; )
            t = n;
        return t
    }
    function g(n) {
        for (var t = new s, e = 0, r = arguments.length; ++e < r; )
            t[arguments[e]] = l(t);
        return t.of = function(e, r) {
            return function(u) {
                try {
                    var i = u.sourceEvent = Bo.event;
                    u.target = n,
                    Bo.event = u,
                    t[u.type].apply(e, r)
                } finally {
                    Bo.event = i
                }
            }
        }
        ,
        t
    }
    function p(n) {
        return ga(n, ya),
        n
    }
    function v(n) {
        return "function" == typeof n ? n : function() {
            return pa(n, this)
        }
    }
    function d(n) {
        return "function" == typeof n ? n : function() {
            return va(n, this)
        }
    }
    function m(n, t) {
        function e() {
            this.removeAttribute(n)
        }
        function r() {
            this.removeAttributeNS(n.space, n.local)
        }
        function u() {
            this.setAttribute(n, t)
        }
        function i() {
            this.setAttributeNS(n.space, n.local, t)
        }
        function o() {
            var e = t.apply(this, arguments);
            null == e ? this.removeAttribute(n) : this.setAttribute(n, e)
        }
        function a() {
            var e = t.apply(this, arguments);
            null == e ? this.removeAttributeNS(n.space, n.local) : this.setAttributeNS(n.space, n.local, e)
        }
        return n = Bo.ns.qualify(n),
        null == t ? n.local ? r : e : "function" == typeof t ? n.local ? a : o : n.local ? i : u
    }
    function y(n) {
        return n.trim().replace(/\s+/g, " ")
    }
    function x(n) {
        return new RegExp("(?:^|\\s+)" + Bo.requote(n) + "(?:\\s+|$)","g")
    }
    function M(n) {
        return n.trim().split(/^|\s+/)
    }
    function _(n, t) {
        function e() {
            for (var e = -1; ++e < u; )
                n[e](this, t)
        }
        function r() {
            for (var e = -1, r = t.apply(this, arguments); ++e < u; )
                n[e](this, r)
        }
        n = M(n).map(b);
        var u = n.length;
        return "function" == typeof t ? r : e
    }
    function b(n) {
        var t = x(n);
        return function(e, r) {
            if (u = e.classList)
                return r ? u.add(n) : u.remove(n);
            var u = e.getAttribute("class") || "";
            r ? (t.lastIndex = 0,
            t.test(u) || e.setAttribute("class", y(u + " " + n))) : e.setAttribute("class", y(u.replace(t, " ")))
        }
    }
    function w(n, t, e) {
        function r() {
            this.style.removeProperty(n)
        }
        function u() {
            this.style.setProperty(n, t, e)
        }
        function i() {
            var r = t.apply(this, arguments);
            null == r ? this.style.removeProperty(n) : this.style.setProperty(n, r, e)
        }
        return null == t ? r : "function" == typeof t ? i : u
    }
    function S(n, t) {
        function e() {
            delete this[n]
        }
        function r() {
            this[n] = t
        }
        function u() {
            var e = t.apply(this, arguments);
            null == e ? delete this[n] : this[n] = e
        }
        return null == t ? e : "function" == typeof t ? u : r
    }
    function k(n) {
        return "function" == typeof n ? n : (n = Bo.ns.qualify(n)).local ? function() {
            return this.ownerDocument.createElementNS(n.space, n.local)
        }
        : function() {
            return this.ownerDocument.createElementNS(this.namespaceURI, n)
        }
    }
    function E(n) {
        return {
            __data__: n
        }
    }
    function A(n) {
        return function() {
            return ma(this, n)
        }
    }
    function C(n) {
        return arguments.length || (n = Bo.ascending),
        function(t, e) {
            return t && e ? n(t.__data__, e.__data__) : !t - !e
        }
    }
    function N(n, t) {
        for (var e = 0, r = n.length; r > e; e++)
            for (var u, i = n[e], o = 0, a = i.length; a > o; o++)
                (u = i[o]) && t(u, o, e);
        return n
    }
    function L(n) {
        return ga(n, Ma),
        n
    }
    function T(n) {
        var t, e;
        return function(r, u, i) {
            var o, a = n[i].update, c = a.length;
            for (i != e && (e = i,
            t = 0),
            u >= t && (t = u + 1); !(o = a[t]) && ++t < c; )
                ;
            return o
        }
    }
    function q() {
        var n = this.__transition__;
        n && ++n.active
    }
    function z(n, t, e) {
        function r() {
            var t = this[o];
            t && (this.removeEventListener(n, t, t.$),
            delete this[o])
        }
        function u() {
            var u = s(t, Jo(arguments));
            r.call(this),
            this.addEventListener(n, this[o] = u, {
                capture: u.$ = e,
                passive: false
            }),
            u._ = t
        }
        function i() {
            var t, e = new RegExp("^__on([^.]+)" + Bo.requote(n) + "$");
            for (var r in this)
                if (t = r.match(e)) {
                    var u = this[r];
                    this.removeEventListener(t[1], u, u.$),
                    delete this[r]
                }
        }
        var o = "__on" + n
          , a = n.indexOf(".")
          , s = R;
        a > 0 && (n = n.substring(0, a));
        var l = ba.get(n);
        return l && (n = l,
        s = D),
        a ? t ? u : r : t ? c : i
    }
    function R(n, t) {
        return function(e) {
            var r = Bo.event;
            Bo.event = e,
            t[0] = this.__data__;
            try {
                n.apply(this, t)
            } finally {
                Bo.event = r
            }
        }
    }
    function D(n, t) {
        var e = R(n, t);
        return function(n) {
            var t = this
              , r = n.relatedTarget;
            r && (r === t || 8 & r.compareDocumentPosition(t)) || e.call(t, n)
        }
    }
    function P() {
        var n = ".dragsuppress-" + ++Sa
          , t = "click" + n
          , e = Bo.select(Qo).on("touchmove" + n, f).on("dragstart" + n, f).on("selectstart" + n, f);
        if (wa) {
            var r = Ko.style
              , u = r[wa];
            r[wa] = "none"
        }
        return function(i) {
            function o() {
                e.on(t, null)
            }
            e.on(n, null),
            wa && (r[wa] = u),
            i && (e.on(t, function() {
                f(),
                o()
            }, !0),
            setTimeout(o, 0))
        }
    }
    function U(n, t) {
        t.changedTouches && (t = t.changedTouches[0]);
        var e = n.ownerSVGElement || n;
        if (e.createSVGPoint) {
            var r = e.createSVGPoint();
            if (0 > ka && (Qo.scrollX || Qo.scrollY)) {
                e = Bo.select("body").append("svg").style({
                    position: "absolute",
                    top: 0,
                    left: 0,
                    margin: 0,
                    padding: 0,
                    border: "none"
                }, "important");
                var u = e[0][0].getScreenCTM();
                ka = !(u.f || u.e),
                e.remove()
            }
            return ka ? (r.x = t.pageX,
            r.y = t.pageY) : (r.x = t.clientX,
            r.y = t.clientY),
            r = r.matrixTransform(n.getScreenCTM().inverse()),
            [r.x, r.y]
        }
        var i = n.getBoundingClientRect();
        return [t.clientX - i.left - n.clientLeft, t.clientY - i.top - n.clientTop]
    }
    function j(n) {
        return n > 0 ? 1 : 0 > n ? -1 : 0
    }
    function H(n) {
        return n > 1 ? 0 : -1 > n ? Ea : Math.acos(n)
    }
    function F(n) {
        return n > 1 ? Ca : -1 > n ? -Ca : Math.asin(n)
    }
    function O(n) {
        return ((n = Math.exp(n)) - 1 / n) / 2
    }
    function Y(n) {
        return ((n = Math.exp(n)) + 1 / n) / 2
    }
    function I(n) {
        return ((n = Math.exp(2 * n)) - 1) / (n + 1)
    }
    function Z(n) {
        return (n = Math.sin(n / 2)) * n
    }
    function V() {}
    function X(n, t, e) {
        return new $(n,t,e)
    }
    function $(n, t, e) {
        this.h = n,
        this.s = t,
        this.l = e
    }
    function B(n, t, e) {
        function r(n) {
            return n > 360 ? n -= 360 : 0 > n && (n += 360),
            60 > n ? i + (o - i) * n / 60 : 180 > n ? o : 240 > n ? i + (o - i) * (240 - n) / 60 : i
        }
        function u(n) {
            return Math.round(255 * r(n))
        }
        var i, o;
        return n = isNaN(n) ? 0 : (n %= 360) < 0 ? n + 360 : n,
        t = isNaN(t) ? 0 : 0 > t ? 0 : t > 1 ? 1 : t,
        e = 0 > e ? 0 : e > 1 ? 1 : e,
        o = .5 >= e ? e * (1 + t) : e + t - e * t,
        i = 2 * e - o,
        at(u(n + 120), u(n), u(n - 120))
    }
    function W(n, t, e) {
        return new J(n,t,e)
    }
    function J(n, t, e) {
        this.h = n,
        this.c = t,
        this.l = e
    }
    function G(n, t, e) {
        return isNaN(n) && (n = 0),
        isNaN(t) && (t = 0),
        K(e, Math.cos(n *= Ta) * t, Math.sin(n) * t)
    }
    function K(n, t, e) {
        return new Q(n,t,e)
    }
    function Q(n, t, e) {
        this.l = n,
        this.a = t,
        this.b = e
    }
    function nt(n, t, e) {
        var r = (n + 16) / 116
          , u = r + t / 500
          , i = r - e / 200;
        return u = et(u) * Ya,
        r = et(r) * Ia,
        i = et(i) * Za,
        at(ut(3.2404542 * u - 1.5371385 * r - .4985314 * i), ut(-.969266 * u + 1.8760108 * r + .041556 * i), ut(.0556434 * u - .2040259 * r + 1.0572252 * i))
    }
    function tt(n, t, e) {
        return n > 0 ? W(Math.atan2(e, t) * qa, Math.sqrt(t * t + e * e), n) : W(0 / 0, 0 / 0, n)
    }
    function et(n) {
        return n > .206893034 ? n * n * n : (n - 4 / 29) / 7.787037
    }
    function rt(n) {
        return n > .008856 ? Math.pow(n, 1 / 3) : 7.787037 * n + 4 / 29
    }
    function ut(n) {
        return Math.round(255 * (.00304 >= n ? 12.92 * n : 1.055 * Math.pow(n, 1 / 2.4) - .055))
    }
    function it(n) {
        return at(n >> 16, 255 & n >> 8, 255 & n)
    }
    function ot(n) {
        return it(n) + ""
    }
    function at(n, t, e) {
        return new ct(n,t,e)
    }
    function ct(n, t, e) {
        this.r = n,
        this.g = t,
        this.b = e
    }
    function st(n) {
        return 16 > n ? "0" + Math.max(0, n).toString(16) : Math.min(255, n).toString(16)
    }
    function lt(n, t, e) {
        var r, u, i, o = 0, a = 0, c = 0;
        if (r = /([a-z]+)\((.*)\)/i.exec(n))
            switch (u = r[2].split(","),
            r[1]) {
            case "hsl":
                return e(parseFloat(u[0]), parseFloat(u[1]) / 100, parseFloat(u[2]) / 100);
            case "rgb":
                return t(pt(u[0]), pt(u[1]), pt(u[2]))
            }
        return (i = $a.get(n)) ? t(i.r, i.g, i.b) : (null != n && "#" === n.charAt(0) && (4 === n.length ? (o = n.charAt(1),
        o += o,
        a = n.charAt(2),
        a += a,
        c = n.charAt(3),
        c += c) : 7 === n.length && (o = n.substring(1, 3),
        a = n.substring(3, 5),
        c = n.substring(5, 7)),
        o = parseInt(o, 16),
        a = parseInt(a, 16),
        c = parseInt(c, 16)),
        t(o, a, c))
    }
    function ft(n, t, e) {
        var r, u, i = Math.min(n /= 255, t /= 255, e /= 255), o = Math.max(n, t, e), a = o - i, c = (o + i) / 2;
        return a ? (u = .5 > c ? a / (o + i) : a / (2 - o - i),
        r = n == o ? (t - e) / a + (e > t ? 6 : 0) : t == o ? (e - n) / a + 2 : (n - t) / a + 4,
        r *= 60) : (r = 0 / 0,
        u = c > 0 && 1 > c ? 0 : r),
        X(r, u, c)
    }
    function ht(n, t, e) {
        n = gt(n),
        t = gt(t),
        e = gt(e);
        var r = rt((.4124564 * n + .3575761 * t + .1804375 * e) / Ya)
          , u = rt((.2126729 * n + .7151522 * t + .072175 * e) / Ia)
          , i = rt((.0193339 * n + .119192 * t + .9503041 * e) / Za);
        return K(116 * u - 16, 500 * (r - u), 200 * (u - i))
    }
    function gt(n) {
        return (n /= 255) <= .04045 ? n / 12.92 : Math.pow((n + .055) / 1.055, 2.4)
    }
    function pt(n) {
        var t = parseFloat(n);
        return "%" === n.charAt(n.length - 1) ? Math.round(2.55 * t) : t
    }
    function vt(n) {
        return "function" == typeof n ? n : function() {
            return n
        }
    }
    function dt(n) {
        return n
    }
    function mt(n) {
        return function(t, e, r) {
            return 2 === arguments.length && "function" == typeof e && (r = e,
            e = null),
            yt(t, e, n, r)
        }
    }
    function yt(n, t, e, r) {
        function u() {
            var n, t = c.status;
            if (!t && c.responseText || t >= 200 && 300 > t || 304 === t) {
                try {
                    n = e.call(i, c)
                } catch (r) {
                    return o.error.call(i, r),
                    void 0
                }
                o.load.call(i, n)
            } else
                o.error.call(i, c)
        }
        var i = {}
          , o = Bo.dispatch("beforesend", "progress", "load", "error")
          , a = {}
          , c = new XMLHttpRequest
          , s = null;
        return !Qo.XDomainRequest || "withCredentials"in c || !/^(http(s)?:)?\/\//.test(n) || (c = new XDomainRequest),
        "onload"in c ? c.onload = c.onerror = u : c.onreadystatechange = function() {
            c.readyState > 3 && u()
        }
        ,
        c.onprogress = function(n) {
            var t = Bo.event;
            Bo.event = n;
            try {
                o.progress.call(i, c)
            } finally {
                Bo.event = t
            }
        }
        ,
        i.header = function(n, t) {
            return n = (n + "").toLowerCase(),
            arguments.length < 2 ? a[n] : (null == t ? delete a[n] : a[n] = t + "",
            i)
        }
        ,
        i.mimeType = function(n) {
            return arguments.length ? (t = null == n ? null : n + "",
            i) : t
        }
        ,
        i.responseType = function(n) {
            return arguments.length ? (s = n,
            i) : s
        }
        ,
        i.response = function(n) {
            return e = n,
            i
        }
        ,
        ["get", "post"].forEach(function(n) {
            i[n] = function() {
                return i.send.apply(i, [n].concat(Jo(arguments)))
            }
        }),
        i.send = function(e, r, u) {
            if (2 === arguments.length && "function" == typeof r && (u = r,
            r = null),
            c.open(e, n, !0),
            null == t || "accept"in a || (a.accept = t + ",*/*"),
            c.setRequestHeader)
                for (var l in a)
                    c.setRequestHeader(l, a[l]);
            return null != t && c.overrideMimeType && c.overrideMimeType(t),
            null != s && (c.responseType = s),
            null != u && i.on("error", u).on("load", function(n) {
                u(null, n)
            }),
            o.beforesend.call(i, c),
            c.send(null == r ? null : r),
            i
        }
        ,
        i.abort = function() {
            return c.abort(),
            i
        }
        ,
        Bo.rebind(i, o, "on"),
        null == r ? i : i.get(xt(r))
    }
    function xt(n) {
        return 1 === n.length ? function(t, e) {
            n(null == t ? e : null)
        }
        : n
    }
    function Mt() {
        var n = _t()
          , t = bt() - n;
        t > 24 ? (isFinite(t) && (clearTimeout(Ga),
        Ga = setTimeout(Mt, t)),
        Ja = 0) : (Ja = 1,
        Qa(Mt))
    }
    function _t() {
        var n = Date.now();
        for (Ka = Ba; Ka; )
            n >= Ka.t && (Ka.f = Ka.c(n - Ka.t)),
            Ka = Ka.n;
        return n
    }
    function bt() {
        for (var n, t = Ba, e = 1 / 0; t; )
            t.f ? t = n ? n.n = t.n : Ba = t.n : (t.t < e && (e = t.t),
            t = (n = t).n);
        return Wa = n,
        e
    }
    function wt(n, t) {
        var e = Math.pow(10, 3 * ca(8 - t));
        return {
            scale: t > 8 ? function(n) {
                return n / e
            }
            : function(n) {
                return n * e
            }
            ,
            symbol: n
        }
    }
    function St(n, t) {
        return t - (n ? Math.ceil(Math.log(n) / Math.LN10) : 1)
    }
    function kt(n) {
        return n + ""
    }
    function Et() {}
    function At(n, t, e) {
        var r = e.s = n + t
          , u = r - n
          , i = r - u;
        e.t = n - i + (t - u)
    }
    function Ct(n, t) {
        n && fc.hasOwnProperty(n.type) && fc[n.type](n, t)
    }
    function Nt(n, t, e) {
        var r, u = -1, i = n.length - e;
        for (t.lineStart(); ++u < i; )
            r = n[u],
            t.point(r[0], r[1], r[2]);
        t.lineEnd()
    }
    function Lt(n, t) {
        var e = -1
          , r = n.length;
        for (t.polygonStart(); ++e < r; )
            Nt(n[e], t, 1);
        t.polygonEnd()
    }
    function Tt() {
        function n(n, t) {
            n *= Ta,
            t = t * Ta / 2 + Ea / 4;
            var e = n - r
              , o = Math.cos(t)
              , a = Math.sin(t)
              , c = i * a
              , s = u * o + c * Math.cos(e)
              , l = c * Math.sin(e);
            gc.add(Math.atan2(l, s)),
            r = n,
            u = o,
            i = a
        }
        var t, e, r, u, i;
        pc.point = function(o, a) {
            pc.point = n,
            r = (t = o) * Ta,
            u = Math.cos(a = (e = a) * Ta / 2 + Ea / 4),
            i = Math.sin(a)
        }
        ,
        pc.lineEnd = function() {
            n(t, e)
        }
    }
    function qt(n) {
        var t = n[0]
          , e = n[1]
          , r = Math.cos(e);
        return [r * Math.cos(t), r * Math.sin(t), Math.sin(e)]
    }
    function zt(n, t) {
        return n[0] * t[0] + n[1] * t[1] + n[2] * t[2]
    }
    function Rt(n, t) {
        return [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]]
    }
    function Dt(n, t) {
        n[0] += t[0],
        n[1] += t[1],
        n[2] += t[2]
    }
    function Pt(n, t) {
        return [n[0] * t, n[1] * t, n[2] * t]
    }
    function Ut(n) {
        var t = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
        n[0] /= t,
        n[1] /= t,
        n[2] /= t
    }
    function jt(n) {
        return [Math.atan2(n[1], n[0]), F(n[2])]
    }
    function Ht(n, t) {
        return ca(n[0] - t[0]) < Na && ca(n[1] - t[1]) < Na
    }
    function Ft(n, t) {
        n *= Ta;
        var e = Math.cos(t *= Ta);
        Ot(e * Math.cos(n), e * Math.sin(n), Math.sin(t))
    }
    function Ot(n, t, e) {
        ++vc,
        mc += (n - mc) / vc,
        yc += (t - yc) / vc,
        xc += (e - xc) / vc
    }
    function Yt() {
        function n(n, u) {
            n *= Ta;
            var i = Math.cos(u *= Ta)
              , o = i * Math.cos(n)
              , a = i * Math.sin(n)
              , c = Math.sin(u)
              , s = Math.atan2(Math.sqrt((s = e * c - r * a) * s + (s = r * o - t * c) * s + (s = t * a - e * o) * s), t * o + e * a + r * c);
            dc += s,
            Mc += s * (t + (t = o)),
            _c += s * (e + (e = a)),
            bc += s * (r + (r = c)),
            Ot(t, e, r)
        }
        var t, e, r;
        Ec.point = function(u, i) {
            u *= Ta;
            var o = Math.cos(i *= Ta);
            t = o * Math.cos(u),
            e = o * Math.sin(u),
            r = Math.sin(i),
            Ec.point = n,
            Ot(t, e, r)
        }
    }
    function It() {
        Ec.point = Ft
    }
    function Zt() {
        function n(n, t) {
            n *= Ta;
            var e = Math.cos(t *= Ta)
              , o = e * Math.cos(n)
              , a = e * Math.sin(n)
              , c = Math.sin(t)
              , s = u * c - i * a
              , l = i * o - r * c
              , f = r * a - u * o
              , h = Math.sqrt(s * s + l * l + f * f)
              , g = r * o + u * a + i * c
              , p = h && -H(g) / h
              , v = Math.atan2(h, g);
            wc += p * s,
            Sc += p * l,
            kc += p * f,
            dc += v,
            Mc += v * (r + (r = o)),
            _c += v * (u + (u = a)),
            bc += v * (i + (i = c)),
            Ot(r, u, i)
        }
        var t, e, r, u, i;
        Ec.point = function(o, a) {
            t = o,
            e = a,
            Ec.point = n,
            o *= Ta;
            var c = Math.cos(a *= Ta);
            r = c * Math.cos(o),
            u = c * Math.sin(o),
            i = Math.sin(a),
            Ot(r, u, i)
        }
        ,
        Ec.lineEnd = function() {
            n(t, e),
            Ec.lineEnd = It,
            Ec.point = Ft
        }
    }
    function Vt() {
        return !0
    }
    function Xt(n, t, e, r, u) {
        var i = []
          , o = [];
        if (n.forEach(function(n) {
            if (!((t = n.length - 1) <= 0)) {
                var t, e = n[0], r = n[t];
                if (Ht(e, r)) {
                    u.lineStart();
                    for (var a = 0; t > a; ++a)
                        u.point((e = n[a])[0], e[1]);
                    return u.lineEnd(),
                    void 0
                }
                var c = new Bt(e,n,null,!0)
                  , s = new Bt(e,null,c,!1);
                c.o = s,
                i.push(c),
                o.push(s),
                c = new Bt(r,n,null,!1),
                s = new Bt(r,null,c,!0),
                c.o = s,
                i.push(c),
                o.push(s)
            }
        }),
        o.sort(t),
        $t(i),
        $t(o),
        i.length) {
            for (var a = 0, c = e, s = o.length; s > a; ++a)
                o[a].e = c = !c;
            for (var l, f, h = i[0]; ; ) {
                for (var g = h, p = !0; g.v; )
                    if ((g = g.n) === h)
                        return;
                l = g.z,
                u.lineStart();
                do {
                    if (g.v = g.o.v = !0,
                    g.e) {
                        if (p)
                            for (var a = 0, s = l.length; s > a; ++a)
                                u.point((f = l[a])[0], f[1]);
                        else
                            r(g.x, g.n.x, 1, u);
                        g = g.n
                    } else {
                        if (p) {
                            l = g.p.z;
                            for (var a = l.length - 1; a >= 0; --a)
                                u.point((f = l[a])[0], f[1])
                        } else
                            r(g.x, g.p.x, -1, u);
                        g = g.p
                    }
                    g = g.o,
                    l = g.z,
                    p = !p
                } while (!g.v);
                u.lineEnd()
            }
        }
    }
    function $t(n) {
        if (t = n.length) {
            for (var t, e, r = 0, u = n[0]; ++r < t; )
                u.n = e = n[r],
                e.p = u,
                u = e;
            u.n = e = n[0],
            e.p = u
        }
    }
    function Bt(n, t, e, r) {
        this.x = n,
        this.z = t,
        this.o = e,
        this.e = r,
        this.v = !1,
        this.n = this.p = null
    }
    function Wt(n, t, e, r) {
        return function(u, i) {
            function o(t, e) {
                var r = u(t, e);
                n(t = r[0], e = r[1]) && i.point(t, e)
            }
            function a(n, t) {
                var e = u(n, t);
                d.point(e[0], e[1])
            }
            function c() {
                y.point = a,
                d.lineStart()
            }
            function s() {
                y.point = o,
                d.lineEnd()
            }
            function l(n, t) {
                v.push([n, t]);
                var e = u(n, t);
                M.point(e[0], e[1])
            }
            function f() {
                M.lineStart(),
                v = []
            }
            function h() {
                l(v[0][0], v[0][1]),
                M.lineEnd();
                var n, t = M.clean(), e = x.buffer(), r = e.length;
                if (v.pop(),
                p.push(v),
                v = null,
                r) {
                    if (1 & t) {
                        n = e[0];
                        var u, r = n.length - 1, o = -1;
                        for (i.lineStart(); ++o < r; )
                            i.point((u = n[o])[0], u[1]);
                        return i.lineEnd(),
                        void 0
                    }
                    r > 1 && 2 & t && e.push(e.pop().concat(e.shift())),
                    g.push(e.filter(Jt))
                }
            }
            var g, p, v, d = t(i), m = u.invert(r[0], r[1]), y = {
                point: o,
                lineStart: c,
                lineEnd: s,
                polygonStart: function() {
                    y.point = l,
                    y.lineStart = f,
                    y.lineEnd = h,
                    g = [],
                    p = [],
                    i.polygonStart()
                },
                polygonEnd: function() {
                    y.point = o,
                    y.lineStart = c,
                    y.lineEnd = s,
                    g = Bo.merge(g);
                    var n = Qt(m, p);
                    g.length ? Xt(g, Kt, n, e, i) : n && (i.lineStart(),
                    e(null, null, 1, i),
                    i.lineEnd()),
                    i.polygonEnd(),
                    g = p = null
                },
                sphere: function() {
                    i.polygonStart(),
                    i.lineStart(),
                    e(null, null, 1, i),
                    i.lineEnd(),
                    i.polygonEnd()
                }
            }, x = Gt(), M = t(x);
            return y
        }
    }
    function Jt(n) {
        return n.length > 1
    }
    function Gt() {
        var n, t = [];
        return {
            lineStart: function() {
                t.push(n = [])
            },
            point: function(t, e) {
                n.push([t, e])
            },
            lineEnd: c,
            buffer: function() {
                var e = t;
                return t = [],
                n = null,
                e
            },
            rejoin: function() {
                t.length > 1 && t.push(t.pop().concat(t.shift()))
            }
        }
    }
    function Kt(n, t) {
        return ((n = n.x)[0] < 0 ? n[1] - Ca - Na : Ca - n[1]) - ((t = t.x)[0] < 0 ? t[1] - Ca - Na : Ca - t[1])
    }
    function Qt(n, t) {
        var e = n[0]
          , r = n[1]
          , u = [Math.sin(e), -Math.cos(e), 0]
          , i = 0
          , o = 0;
        gc.reset();
        for (var a = 0, c = t.length; c > a; ++a) {
            var s = t[a]
              , l = s.length;
            if (l)
                for (var f = s[0], h = f[0], g = f[1] / 2 + Ea / 4, p = Math.sin(g), v = Math.cos(g), d = 1; ; ) {
                    d === l && (d = 0),
                    n = s[d];
                    var m = n[0]
                      , y = n[1] / 2 + Ea / 4
                      , x = Math.sin(y)
                      , M = Math.cos(y)
                      , _ = m - h
                      , b = ca(_) > Ea
                      , w = p * x;
                    if (gc.add(Math.atan2(w * Math.sin(_), v * M + w * Math.cos(_))),
                    i += b ? _ + (_ >= 0 ? Aa : -Aa) : _,
                    b ^ h >= e ^ m >= e) {
                        var S = Rt(qt(f), qt(n));
                        Ut(S);
                        var k = Rt(u, S);
                        Ut(k);
                        var E = (b ^ _ >= 0 ? -1 : 1) * F(k[2]);
                        (r > E || r === E && (S[0] || S[1])) && (o += b ^ _ >= 0 ? 1 : -1)
                    }
                    if (!d++)
                        break;
                    h = m,
                    p = x,
                    v = M,
                    f = n
                }
        }
        return (-Na > i || Na > i && 0 > gc) ^ 1 & o
    }
    function ne(n) {
        var t, e = 0 / 0, r = 0 / 0, u = 0 / 0;
        return {
            lineStart: function() {
                n.lineStart(),
                t = 1
            },
            point: function(i, o) {
                var a = i > 0 ? Ea : -Ea
                  , c = ca(i - e);
                ca(c - Ea) < Na ? (n.point(e, r = (r + o) / 2 > 0 ? Ca : -Ca),
                n.point(u, r),
                n.lineEnd(),
                n.lineStart(),
                n.point(a, r),
                n.point(i, r),
                t = 0) : u !== a && c >= Ea && (ca(e - u) < Na && (e -= u * Na),
                ca(i - a) < Na && (i -= a * Na),
                r = te(e, r, i, o),
                n.point(u, r),
                n.lineEnd(),
                n.lineStart(),
                n.point(a, r),
                t = 0),
                n.point(e = i, r = o),
                u = a
            },
            lineEnd: function() {
                n.lineEnd(),
                e = r = 0 / 0
            },
            clean: function() {
                return 2 - t
            }
        }
    }
    function te(n, t, e, r) {
        var u, i, o = Math.sin(n - e);
        return ca(o) > Na ? Math.atan((Math.sin(t) * (i = Math.cos(r)) * Math.sin(e) - Math.sin(r) * (u = Math.cos(t)) * Math.sin(n)) / (u * i * o)) : (t + r) / 2
    }
    function ee(n, t, e, r) {
        var u;
        if (null == n)
            u = e * Ca,
            r.point(-Ea, u),
            r.point(0, u),
            r.point(Ea, u),
            r.point(Ea, 0),
            r.point(Ea, -u),
            r.point(0, -u),
            r.point(-Ea, -u),
            r.point(-Ea, 0),
            r.point(-Ea, u);
        else if (ca(n[0] - t[0]) > Na) {
            var i = n[0] < t[0] ? Ea : -Ea;
            u = e * i / 2,
            r.point(-i, u),
            r.point(0, u),
            r.point(i, u)
        } else
            r.point(t[0], t[1])
    }
    function re(n) {
        function t(n, t) {
            return Math.cos(n) * Math.cos(t) > i
        }
        function e(n) {
            var e, i, c, s, l;
            return {
                lineStart: function() {
                    s = c = !1,
                    l = 1
                },
                point: function(f, h) {
                    var g, p = [f, h], v = t(f, h), d = o ? v ? 0 : u(f, h) : v ? u(f + (0 > f ? Ea : -Ea), h) : 0;
                    if (!e && (s = c = v) && n.lineStart(),
                    v !== c && (g = r(e, p),
                    (Ht(e, g) || Ht(p, g)) && (p[0] += Na,
                    p[1] += Na,
                    v = t(p[0], p[1]))),
                    v !== c)
                        l = 0,
                        v ? (n.lineStart(),
                        g = r(p, e),
                        n.point(g[0], g[1])) : (g = r(e, p),
                        n.point(g[0], g[1]),
                        n.lineEnd()),
                        e = g;
                    else if (a && e && o ^ v) {
                        var m;
                        d & i || !(m = r(p, e, !0)) || (l = 0,
                        o ? (n.lineStart(),
                        n.point(m[0][0], m[0][1]),
                        n.point(m[1][0], m[1][1]),
                        n.lineEnd()) : (n.point(m[1][0], m[1][1]),
                        n.lineEnd(),
                        n.lineStart(),
                        n.point(m[0][0], m[0][1])))
                    }
                    !v || e && Ht(e, p) || n.point(p[0], p[1]),
                    e = p,
                    c = v,
                    i = d
                },
                lineEnd: function() {
                    c && n.lineEnd(),
                    e = null
                },
                clean: function() {
                    return l | (s && c) << 1
                }
            }
        }
        function r(n, t, e) {
            var r = qt(n)
              , u = qt(t)
              , o = [1, 0, 0]
              , a = Rt(r, u)
              , c = zt(a, a)
              , s = a[0]
              , l = c - s * s;
            if (!l)
                return !e && n;
            var f = i * c / l
              , h = -i * s / l
              , g = Rt(o, a)
              , p = Pt(o, f)
              , v = Pt(a, h);
            Dt(p, v);
            var d = g
              , m = zt(p, d)
              , y = zt(d, d)
              , x = m * m - y * (zt(p, p) - 1);
            if (!(0 > x)) {
                var M = Math.sqrt(x)
                  , _ = Pt(d, (-m - M) / y);
                if (Dt(_, p),
                _ = jt(_),
                !e)
                    return _;
                var b, w = n[0], S = t[0], k = n[1], E = t[1];
                w > S && (b = w,
                w = S,
                S = b);
                var A = S - w
                  , C = ca(A - Ea) < Na
                  , N = C || Na > A;
                if (!C && k > E && (b = k,
                k = E,
                E = b),
                N ? C ? k + E > 0 ^ _[1] < (ca(_[0] - w) < Na ? k : E) : k <= _[1] && _[1] <= E : A > Ea ^ (w <= _[0] && _[0] <= S)) {
                    var L = Pt(d, (-m + M) / y);
                    return Dt(L, p),
                    [_, jt(L)]
                }
            }
        }
        function u(t, e) {
            var r = o ? n : Ea - n
              , u = 0;
            return -r > t ? u |= 1 : t > r && (u |= 2),
            -r > e ? u |= 4 : e > r && (u |= 8),
            u
        }
        var i = Math.cos(n)
          , o = i > 0
          , a = ca(i) > Na
          , c = Te(n, 6 * Ta);
        return Wt(t, e, c, o ? [0, -n] : [-Ea, n - Ea])
    }
    function ue(n, t, e, r) {
        return function(u) {
            var i, o = u.a, a = u.b, c = o.x, s = o.y, l = a.x, f = a.y, h = 0, g = 1, p = l - c, v = f - s;
            if (i = n - c,
            p || !(i > 0)) {
                if (i /= p,
                0 > p) {
                    if (h > i)
                        return;
                    g > i && (g = i)
                } else if (p > 0) {
                    if (i > g)
                        return;
                    i > h && (h = i)
                }
                if (i = e - c,
                p || !(0 > i)) {
                    if (i /= p,
                    0 > p) {
                        if (i > g)
                            return;
                        i > h && (h = i)
                    } else if (p > 0) {
                        if (h > i)
                            return;
                        g > i && (g = i)
                    }
                    if (i = t - s,
                    v || !(i > 0)) {
                        if (i /= v,
                        0 > v) {
                            if (h > i)
                                return;
                            g > i && (g = i)
                        } else if (v > 0) {
                            if (i > g)
                                return;
                            i > h && (h = i)
                        }
                        if (i = r - s,
                        v || !(0 > i)) {
                            if (i /= v,
                            0 > v) {
                                if (i > g)
                                    return;
                                i > h && (h = i)
                            } else if (v > 0) {
                                if (h > i)
                                    return;
                                g > i && (g = i)
                            }
                            return h > 0 && (u.a = {
                                x: c + h * p,
                                y: s + h * v
                            }),
                            1 > g && (u.b = {
                                x: c + g * p,
                                y: s + g * v
                            }),
                            u
                        }
                    }
                }
            }
        }
    }
    function ie(n, t, e, r) {
        function u(r, u) {
            return ca(r[0] - n) < Na ? u > 0 ? 0 : 3 : ca(r[0] - e) < Na ? u > 0 ? 2 : 1 : ca(r[1] - t) < Na ? u > 0 ? 1 : 0 : u > 0 ? 3 : 2
        }
        function i(n, t) {
            return o(n.x, t.x)
        }
        function o(n, t) {
            var e = u(n, 1)
              , r = u(t, 1);
            return e !== r ? e - r : 0 === e ? t[1] - n[1] : 1 === e ? n[0] - t[0] : 2 === e ? n[1] - t[1] : t[0] - n[0]
        }
        return function(a) {
            function c(n) {
                for (var t = 0, e = m.length, r = n[1], u = 0; e > u; ++u)
                    for (var i, o = 1, a = m[u], c = a.length, l = a[0]; c > o; ++o)
                        i = a[o],
                        l[1] <= r ? i[1] > r && s(l, i, n) > 0 && ++t : i[1] <= r && s(l, i, n) < 0 && --t,
                        l = i;
                return 0 !== t
            }
            function s(n, t, e) {
                return (t[0] - n[0]) * (e[1] - n[1]) - (e[0] - n[0]) * (t[1] - n[1])
            }
            function l(i, a, c, s) {
                var l = 0
                  , f = 0;
                if (null == i || (l = u(i, c)) !== (f = u(a, c)) || o(i, a) < 0 ^ c > 0) {
                    do
                        s.point(0 === l || 3 === l ? n : e, l > 1 ? r : t);
                    while ((l = (l + c + 4) % 4) !== f)
                } else
                    s.point(a[0], a[1])
            }
            function f(u, i) {
                return u >= n && e >= u && i >= t && r >= i
            }
            function h(n, t) {
                f(n, t) && a.point(n, t)
            }
            function g() {
                L.point = v,
                m && m.push(y = []),
                k = !0,
                S = !1,
                b = w = 0 / 0
            }
            function p() {
                d && (v(x, M),
                _ && S && C.rejoin(),
                d.push(C.buffer())),
                L.point = h,
                S && a.lineEnd()
            }
            function v(n, t) {
                n = Math.max(-Cc, Math.min(Cc, n)),
                t = Math.max(-Cc, Math.min(Cc, t));
                var e = f(n, t);
                if (m && y.push([n, t]),
                k)
                    x = n,
                    M = t,
                    _ = e,
                    k = !1,
                    e && (a.lineStart(),
                    a.point(n, t));
                else if (e && S)
                    a.point(n, t);
                else {
                    var r = {
                        a: {
                            x: b,
                            y: w
                        },
                        b: {
                            x: n,
                            y: t
                        }
                    };
                    N(r) ? (S || (a.lineStart(),
                    a.point(r.a.x, r.a.y)),
                    a.point(r.b.x, r.b.y),
                    e || a.lineEnd(),
                    E = !1) : e && (a.lineStart(),
                    a.point(n, t),
                    E = !1)
                }
                b = n,
                w = t,
                S = e
            }
            var d, m, y, x, M, _, b, w, S, k, E, A = a, C = Gt(), N = ue(n, t, e, r), L = {
                point: h,
                lineStart: g,
                lineEnd: p,
                polygonStart: function() {
                    a = C,
                    d = [],
                    m = [],
                    E = !0
                },
                polygonEnd: function() {
                    a = A,
                    d = Bo.merge(d);
                    var t = c([n, r])
                      , e = E && t
                      , u = d.length;
                    (e || u) && (a.polygonStart(),
                    e && (a.lineStart(),
                    l(null, null, 1, a),
                    a.lineEnd()),
                    u && Xt(d, i, t, l, a),
                    a.polygonEnd()),
                    d = m = y = null
                }
            };
            return L
        }
    }
    function oe(n, t) {
        function e(e, r) {
            return e = n(e, r),
            t(e[0], e[1])
        }
        return n.invert && t.invert && (e.invert = function(e, r) {
            return e = t.invert(e, r),
            e && n.invert(e[0], e[1])
        }
        ),
        e
    }
    function ae(n) {
        var t = 0
          , e = Ea / 3
          , r = we(n)
          , u = r(t, e);
        return u.parallels = function(n) {
            return arguments.length ? r(t = n[0] * Ea / 180, e = n[1] * Ea / 180) : [180 * (t / Ea), 180 * (e / Ea)]
        }
        ,
        u
    }
    function ce(n, t) {
        function e(n, t) {
            var e = Math.sqrt(i - 2 * u * Math.sin(t)) / u;
            return [e * Math.sin(n *= u), o - e * Math.cos(n)]
        }
        var r = Math.sin(n)
          , u = (r + Math.sin(t)) / 2
          , i = 1 + r * (2 * u - r)
          , o = Math.sqrt(i) / u;
        return e.invert = function(n, t) {
            var e = o - t;
            return [Math.atan2(n, e) / u, F((i - (n * n + e * e) * u * u) / (2 * u))]
        }
        ,
        e
    }
    function se() {
        function n(n, t) {
            Lc += u * n - r * t,
            r = n,
            u = t
        }
        var t, e, r, u;
        Dc.point = function(i, o) {
            Dc.point = n,
            t = r = i,
            e = u = o
        }
        ,
        Dc.lineEnd = function() {
            n(t, e)
        }
    }
    function le(n, t) {
        Tc > n && (Tc = n),
        n > zc && (zc = n),
        qc > t && (qc = t),
        t > Rc && (Rc = t)
    }
    function fe() {
        function n(n, t) {
            o.push("M", n, ",", t, i)
        }
        function t(n, t) {
            o.push("M", n, ",", t),
            a.point = e
        }
        function e(n, t) {
            o.push("L", n, ",", t)
        }
        function r() {
            a.point = n
        }
        function u() {
            o.push("Z")
        }
        var i = he(4.5)
          , o = []
          , a = {
            point: n,
            lineStart: function() {
                a.point = t
            },
            lineEnd: r,
            polygonStart: function() {
                a.lineEnd = u
            },
            polygonEnd: function() {
                a.lineEnd = r,
                a.point = n
            },
            pointRadius: function(n) {
                return i = he(n),
                a
            },
            result: function() {
                if (o.length) {
                    var n = o.join("");
                    return o = [],
                    n
                }
            }
        };
        return a
    }
    function he(n) {
        return "m0," + n + "a" + n + "," + n + " 0 1,1 0," + -2 * n + "a" + n + "," + n + " 0 1,1 0," + 2 * n + "z"
    }
    function ge(n, t) {
        mc += n,
        yc += t,
        ++xc
    }
    function pe() {
        function n(n, r) {
            var u = n - t
              , i = r - e
              , o = Math.sqrt(u * u + i * i);
            Mc += o * (t + n) / 2,
            _c += o * (e + r) / 2,
            bc += o,
            ge(t = n, e = r)
        }
        var t, e;
        Uc.point = function(r, u) {
            Uc.point = n,
            ge(t = r, e = u)
        }
    }
    function ve() {
        Uc.point = ge
    }
    function de() {
        function n(n, t) {
            var e = n - r
              , i = t - u
              , o = Math.sqrt(e * e + i * i);
            Mc += o * (r + n) / 2,
            _c += o * (u + t) / 2,
            bc += o,
            o = u * n - r * t,
            wc += o * (r + n),
            Sc += o * (u + t),
            kc += 3 * o,
            ge(r = n, u = t)
        }
        var t, e, r, u;
        Uc.point = function(i, o) {
            Uc.point = n,
            ge(t = r = i, e = u = o)
        }
        ,
        Uc.lineEnd = function() {
            n(t, e)
        }
    }
    function me(n) {
        function t(t, e) {
            n.moveTo(t, e),
            n.arc(t, e, o, 0, Aa)
        }
        function e(t, e) {
            n.moveTo(t, e),
            a.point = r
        }
        function r(t, e) {
            n.lineTo(t, e)
        }
        function u() {
            a.point = t
        }
        function i() {
            n.closePath()
        }
        var o = 4.5
          , a = {
            point: t,
            lineStart: function() {
                a.point = e
            },
            lineEnd: u,
            polygonStart: function() {
                a.lineEnd = i
            },
            polygonEnd: function() {
                a.lineEnd = u,
                a.point = t
            },
            pointRadius: function(n) {
                return o = n,
                a
            },
            result: c
        };
        return a
    }
    function ye(n) {
        function t(n) {
            return (a ? r : e)(n)
        }
        function e(t) {
            return _e(t, function(e, r) {
                e = n(e, r),
                t.point(e[0], e[1])
            })
        }
        function r(t) {
            function e(e, r) {
                e = n(e, r),
                t.point(e[0], e[1])
            }
            function r() {
                x = 0 / 0,
                S.point = i,
                t.lineStart()
            }
            function i(e, r) {
                var i = qt([e, r])
                  , o = n(e, r);
                u(x, M, y, _, b, w, x = o[0], M = o[1], y = e, _ = i[0], b = i[1], w = i[2], a, t),
                t.point(x, M)
            }
            function o() {
                S.point = e,
                t.lineEnd()
            }
            function c() {
                r(),
                S.point = s,
                S.lineEnd = l
            }
            function s(n, t) {
                i(f = n, h = t),
                g = x,
                p = M,
                v = _,
                d = b,
                m = w,
                S.point = i
            }
            function l() {
                u(x, M, y, _, b, w, g, p, f, v, d, m, a, t),
                S.lineEnd = o,
                o()
            }
            var f, h, g, p, v, d, m, y, x, M, _, b, w, S = {
                point: e,
                lineStart: r,
                lineEnd: o,
                polygonStart: function() {
                    t.polygonStart(),
                    S.lineStart = c
                },
                polygonEnd: function() {
                    t.polygonEnd(),
                    S.lineStart = r
                }
            };
            return S
        }
        function u(t, e, r, a, c, s, l, f, h, g, p, v, d, m) {
            var y = l - t
              , x = f - e
              , M = y * y + x * x;
            if (M > 4 * i && d--) {
                var _ = a + g
                  , b = c + p
                  , w = s + v
                  , S = Math.sqrt(_ * _ + b * b + w * w)
                  , k = Math.asin(w /= S)
                  , E = ca(ca(w) - 1) < Na || ca(r - h) < Na ? (r + h) / 2 : Math.atan2(b, _)
                  , A = n(E, k)
                  , C = A[0]
                  , N = A[1]
                  , L = C - t
                  , T = N - e
                  , q = x * L - y * T;
                (q * q / M > i || ca((y * L + x * T) / M - .5) > .3 || o > a * g + c * p + s * v) && (u(t, e, r, a, c, s, C, N, E, _ /= S, b /= S, w, d, m),
                m.point(C, N),
                u(C, N, E, _, b, w, l, f, h, g, p, v, d, m))
            }
        }
        var i = .5
          , o = Math.cos(30 * Ta)
          , a = 16;
        return t.precision = function(n) {
            return arguments.length ? (a = (i = n * n) > 0 && 16,
            t) : Math.sqrt(i)
        }
        ,
        t
    }
    function xe(n) {
        var t = ye(function(t, e) {
            return n([t * qa, e * qa])
        });
        return function(n) {
            return Se(t(n))
        }
    }
    function Me(n) {
        this.stream = n
    }
    function _e(n, t) {
        return {
            point: t,
            sphere: function() {
                n.sphere()
            },
            lineStart: function() {
                n.lineStart()
            },
            lineEnd: function() {
                n.lineEnd()
            },
            polygonStart: function() {
                n.polygonStart()
            },
            polygonEnd: function() {
                n.polygonEnd()
            }
        }
    }
    function be(n) {
        return we(function() {
            return n
        })()
    }
    function we(n) {
        function t(n) {
            return n = a(n[0] * Ta, n[1] * Ta),
            [n[0] * h + c, s - n[1] * h]
        }
        function e(n) {
            return n = a.invert((n[0] - c) / h, (s - n[1]) / h),
            n && [n[0] * qa, n[1] * qa]
        }
        function r() {
            a = oe(o = Ae(m, y, x), i);
            var n = i(v, d);
            return c = g - n[0] * h,
            s = p + n[1] * h,
            u()
        }
        function u() {
            return l && (l.valid = !1,
            l = null),
            t
        }
        var i, o, a, c, s, l, f = ye(function(n, t) {
            return n = i(n, t),
            [n[0] * h + c, s - n[1] * h]
        }), h = 150, g = 480, p = 250, v = 0, d = 0, m = 0, y = 0, x = 0, M = Ac, _ = dt, b = null, w = null;
        return t.stream = function(n) {
            return l && (l.valid = !1),
            l = Se(M(o, f(_(n)))),
            l.valid = !0,
            l
        }
        ,
        t.clipAngle = function(n) {
            return arguments.length ? (M = null == n ? (b = n,
            Ac) : re((b = +n) * Ta),
            u()) : b
        }
        ,
        t.clipExtent = function(n) {
            return arguments.length ? (w = n,
            _ = n ? ie(n[0][0], n[0][1], n[1][0], n[1][1]) : dt,
            u()) : w
        }
        ,
        t.scale = function(n) {
            return arguments.length ? (h = +n,
            r()) : h
        }
        ,
        t.translate = function(n) {
            return arguments.length ? (g = +n[0],
            p = +n[1],
            r()) : [g, p]
        }
        ,
        t.center = function(n) {
            return arguments.length ? (v = n[0] % 360 * Ta,
            d = n[1] % 360 * Ta,
            r()) : [v * qa, d * qa]
        }
        ,
        t.rotate = function(n) {
            return arguments.length ? (m = n[0] % 360 * Ta,
            y = n[1] % 360 * Ta,
            x = n.length > 2 ? n[2] % 360 * Ta : 0,
            r()) : [m * qa, y * qa, x * qa]
        }
        ,
        Bo.rebind(t, f, "precision"),
        function() {
            return i = n.apply(this, arguments),
            t.invert = i.invert && e,
            r()
        }
    }
    function Se(n) {
        return _e(n, function(t, e) {
            n.point(t * Ta, e * Ta)
        })
    }
    function ke(n, t) {
        return [n, t]
    }
    function Ee(n, t) {
        return [n > Ea ? n - Aa : -Ea > n ? n + Aa : n, t]
    }
    function Ae(n, t, e) {
        return n ? t || e ? oe(Ne(n), Le(t, e)) : Ne(n) : t || e ? Le(t, e) : Ee
    }
    function Ce(n) {
        return function(t, e) {
            return t += n,
            [t > Ea ? t - Aa : -Ea > t ? t + Aa : t, e]
        }
    }
    function Ne(n) {
        var t = Ce(n);
        return t.invert = Ce(-n),
        t
    }
    function Le(n, t) {
        function e(n, t) {
            var e = Math.cos(t)
              , a = Math.cos(n) * e
              , c = Math.sin(n) * e
              , s = Math.sin(t)
              , l = s * r + a * u;
            return [Math.atan2(c * i - l * o, a * r - s * u), F(l * i + c * o)]
        }
        var r = Math.cos(n)
          , u = Math.sin(n)
          , i = Math.cos(t)
          , o = Math.sin(t);
        return e.invert = function(n, t) {
            var e = Math.cos(t)
              , a = Math.cos(n) * e
              , c = Math.sin(n) * e
              , s = Math.sin(t)
              , l = s * i - c * o;
            return [Math.atan2(c * i + s * o, a * r + l * u), F(l * r - a * u)]
        }
        ,
        e
    }
    function Te(n, t) {
        var e = Math.cos(n)
          , r = Math.sin(n);
        return function(u, i, o, a) {
            var c = o * t;
            null != u ? (u = qe(e, u),
            i = qe(e, i),
            (o > 0 ? i > u : u > i) && (u += o * Aa)) : (u = n + o * Aa,
            i = n - .5 * c);
            for (var s, l = u; o > 0 ? l > i : i > l; l -= c)
                a.point((s = jt([e, -r * Math.cos(l), -r * Math.sin(l)]))[0], s[1])
        }
    }
    function qe(n, t) {
        var e = qt(t);
        e[0] -= n,
        Ut(e);
        var r = H(-e[1]);
        return ((-e[2] < 0 ? -r : r) + 2 * Math.PI - Na) % (2 * Math.PI)
    }
    function ze(n, t, e) {
        var r = Bo.range(n, t - Na, e).concat(t);
        return function(n) {
            return r.map(function(t) {
                return [n, t]
            })
        }
    }
    function Re(n, t, e) {
        var r = Bo.range(n, t - Na, e).concat(t);
        return function(n) {
            return r.map(function(t) {
                return [t, n]
            })
        }
    }
    function De(n) {
        return n.source
    }
    function Pe(n) {
        return n.target
    }
    function Ue(n, t, e, r) {
        var u = Math.cos(t)
          , i = Math.sin(t)
          , o = Math.cos(r)
          , a = Math.sin(r)
          , c = u * Math.cos(n)
          , s = u * Math.sin(n)
          , l = o * Math.cos(e)
          , f = o * Math.sin(e)
          , h = 2 * Math.asin(Math.sqrt(Z(r - t) + u * o * Z(e - n)))
          , g = 1 / Math.sin(h)
          , p = h ? function(n) {
            var t = Math.sin(n *= h) * g
              , e = Math.sin(h - n) * g
              , r = e * c + t * l
              , u = e * s + t * f
              , o = e * i + t * a;
            return [Math.atan2(u, r) * qa, Math.atan2(o, Math.sqrt(r * r + u * u)) * qa]
        }
        : function() {
            return [n * qa, t * qa]
        }
        ;
        return p.distance = h,
        p
    }
    function je() {
        function n(n, u) {
            var i = Math.sin(u *= Ta)
              , o = Math.cos(u)
              , a = ca((n *= Ta) - t)
              , c = Math.cos(a);
            jc += Math.atan2(Math.sqrt((a = o * Math.sin(a)) * a + (a = r * i - e * o * c) * a), e * i + r * o * c),
            t = n,
            e = i,
            r = o
        }
        var t, e, r;
        Hc.point = function(u, i) {
            t = u * Ta,
            e = Math.sin(i *= Ta),
            r = Math.cos(i),
            Hc.point = n
        }
        ,
        Hc.lineEnd = function() {
            Hc.point = Hc.lineEnd = c
        }
    }
    function He(n, t) {
        function e(t, e) {
            var r = Math.cos(t)
              , u = Math.cos(e)
              , i = n(r * u);
            return [i * u * Math.sin(t), i * Math.sin(e)]
        }
        return e.invert = function(n, e) {
            var r = Math.sqrt(n * n + e * e)
              , u = t(r)
              , i = Math.sin(u)
              , o = Math.cos(u);
            return [Math.atan2(n * i, r * o), Math.asin(r && e * i / r)]
        }
        ,
        e
    }
    function Fe(n, t) {
        function e(n, t) {
            var e = ca(ca(t) - Ca) < Na ? 0 : o / Math.pow(u(t), i);
            return [e * Math.sin(i * n), o - e * Math.cos(i * n)]
        }
        var r = Math.cos(n)
          , u = function(n) {
            return Math.tan(Ea / 4 + n / 2)
        }
          , i = n === t ? Math.sin(n) : Math.log(r / Math.cos(t)) / Math.log(u(t) / u(n))
          , o = r * Math.pow(u(n), i) / i;
        return i ? (e.invert = function(n, t) {
            var e = o - t
              , r = j(i) * Math.sqrt(n * n + e * e);
            return [Math.atan2(n, e) / i, 2 * Math.atan(Math.pow(o / r, 1 / i)) - Ca]
        }
        ,
        e) : Ye
    }
    function Oe(n, t) {
        function e(n, t) {
            var e = i - t;
            return [e * Math.sin(u * n), i - e * Math.cos(u * n)]
        }
        var r = Math.cos(n)
          , u = n === t ? Math.sin(n) : (r - Math.cos(t)) / (t - n)
          , i = r / u + n;
        return ca(u) < Na ? ke : (e.invert = function(n, t) {
            var e = i - t;
            return [Math.atan2(n, e) / u, i - j(u) * Math.sqrt(n * n + e * e)]
        }
        ,
        e)
    }
    function Ye(n, t) {
        return [n, Math.log(Math.tan(Ea / 4 + t / 2))]
    }
    function Ie(n) {
        var t, e = be(n), r = e.scale, u = e.translate, i = e.clipExtent;
        return e.scale = function() {
            var n = r.apply(e, arguments);
            return n === e ? t ? e.clipExtent(null) : e : n
        }
        ,
        e.translate = function() {
            var n = u.apply(e, arguments);
            return n === e ? t ? e.clipExtent(null) : e : n
        }
        ,
        e.clipExtent = function(n) {
            var o = i.apply(e, arguments);
            if (o === e) {
                if (t = null == n) {
                    var a = Ea * r()
                      , c = u();
                    i([[c[0] - a, c[1] - a], [c[0] + a, c[1] + a]])
                }
            } else
                t && (o = null);
            return o
        }
        ,
        e.clipExtent(null)
    }
    function Ze(n, t) {
        return [Math.log(Math.tan(Ea / 4 + t / 2)), -n]
    }
    function Ve(n) {
        return n[0]
    }
    function Xe(n) {
        return n[1]
    }
    function $e(n, t, e, r) {
        var u, i, o, a, c, s, l;
        return u = r[n],
        i = u[0],
        o = u[1],
        u = r[t],
        a = u[0],
        c = u[1],
        u = r[e],
        s = u[0],
        l = u[1],
        (l - o) * (a - i) - (c - o) * (s - i) > 0
    }
    function Be(n, t, e) {
        return (e[0] - t[0]) * (n[1] - t[1]) < (e[1] - t[1]) * (n[0] - t[0])
    }
    function We(n, t, e, r) {
        var u = n[0]
          , i = e[0]
          , o = t[0] - u
          , a = r[0] - i
          , c = n[1]
          , s = e[1]
          , l = t[1] - c
          , f = r[1] - s
          , h = (a * (c - s) - f * (u - i)) / (f * o - a * l);
        return [u + h * o, c + h * l]
    }
    function Je(n) {
        var t = n[0]
          , e = n[n.length - 1];
        return !(t[0] - e[0] || t[1] - e[1])
    }
    function Ge() {
        yr(this),
        this.edge = this.site = this.circle = null
    }
    function Ke(n) {
        var t = Gc.pop() || new Ge;
        return t.site = n,
        t
    }
    function Qe(n) {
        sr(n),
        Bc.remove(n),
        Gc.push(n),
        yr(n)
    }
    function nr(n) {
        var t = n.circle
          , e = t.x
          , r = t.cy
          , u = {
            x: e,
            y: r
        }
          , i = n.P
          , o = n.N
          , a = [n];
        Qe(n);
        for (var c = i; c.circle && ca(e - c.circle.x) < Na && ca(r - c.circle.cy) < Na; )
            i = c.P,
            a.unshift(c),
            Qe(c),
            c = i;
        a.unshift(c),
        sr(c);
        for (var s = o; s.circle && ca(e - s.circle.x) < Na && ca(r - s.circle.cy) < Na; )
            o = s.N,
            a.push(s),
            Qe(s),
            s = o;
        a.push(s),
        sr(s);
        var l, f = a.length;
        for (l = 1; f > l; ++l)
            s = a[l],
            c = a[l - 1],
            vr(s.edge, c.site, s.site, u);
        c = a[0],
        s = a[f - 1],
        s.edge = gr(c.site, s.site, null, u),
        cr(c),
        cr(s)
    }
    function tr(n) {
        for (var t, e, r, u, i = n.x, o = n.y, a = Bc._; a; )
            if (r = er(a, o) - i,
            r > Na)
                a = a.L;
            else {
                if (u = i - rr(a, o),
                !(u > Na)) {
                    r > -Na ? (t = a.P,
                    e = a) : u > -Na ? (t = a,
                    e = a.N) : t = e = a;
                    break
                }
                if (!a.R) {
                    t = a;
                    break
                }
                a = a.R
            }
        var c = Ke(n);
        if (Bc.insert(t, c),
        t || e) {
            if (t === e)
                return sr(t),
                e = Ke(t.site),
                Bc.insert(c, e),
                c.edge = e.edge = gr(t.site, c.site),
                cr(t),
                cr(e),
                void 0;
            if (!e)
                return c.edge = gr(t.site, c.site),
                void 0;
            sr(t),
            sr(e);
            var s = t.site
              , l = s.x
              , f = s.y
              , h = n.x - l
              , g = n.y - f
              , p = e.site
              , v = p.x - l
              , d = p.y - f
              , m = 2 * (h * d - g * v)
              , y = h * h + g * g
              , x = v * v + d * d
              , M = {
                x: (d * y - g * x) / m + l,
                y: (h * x - v * y) / m + f
            };
            vr(e.edge, s, p, M),
            c.edge = gr(s, n, null, M),
            e.edge = gr(n, p, null, M),
            cr(t),
            cr(e)
        }
    }
    function er(n, t) {
        var e = n.site
          , r = e.x
          , u = e.y
          , i = u - t;
        if (!i)
            return r;
        var o = n.P;
        if (!o)
            return -1 / 0;
        e = o.site;
        var a = e.x
          , c = e.y
          , s = c - t;
        if (!s)
            return a;
        var l = a - r
          , f = 1 / i - 1 / s
          , h = l / s;
        return f ? (-h + Math.sqrt(h * h - 2 * f * (l * l / (-2 * s) - c + s / 2 + u - i / 2))) / f + r : (r + a) / 2
    }
    function rr(n, t) {
        var e = n.N;
        if (e)
            return er(e, t);
        var r = n.site;
        return r.y === t ? r.x : 1 / 0
    }
    function ur(n) {
        this.site = n,
        this.edges = []
    }
    function ir(n) {
        for (var t, e, r, u, i, o, a, c, s, l, f = n[0][0], h = n[1][0], g = n[0][1], p = n[1][1], v = $c, d = v.length; d--; )
            if (i = v[d],
            i && i.prepare())
                for (a = i.edges,
                c = a.length,
                o = 0; c > o; )
                    l = a[o].end(),
                    r = l.x,
                    u = l.y,
                    s = a[++o % c].start(),
                    t = s.x,
                    e = s.y,
                    (ca(r - t) > Na || ca(u - e) > Na) && (a.splice(o, 0, new dr(pr(i.site, l, ca(r - f) < Na && p - u > Na ? {
                        x: f,
                        y: ca(t - f) < Na ? e : p
                    } : ca(u - p) < Na && h - r > Na ? {
                        x: ca(e - p) < Na ? t : h,
                        y: p
                    } : ca(r - h) < Na && u - g > Na ? {
                        x: h,
                        y: ca(t - h) < Na ? e : g
                    } : ca(u - g) < Na && r - f > Na ? {
                        x: ca(e - g) < Na ? t : f,
                        y: g
                    } : null),i.site,null)),
                    ++c)
    }
    function or(n, t) {
        return t.angle - n.angle
    }
    function ar() {
        yr(this),
        this.x = this.y = this.arc = this.site = this.cy = null
    }
    function cr(n) {
        var t = n.P
          , e = n.N;
        if (t && e) {
            var r = t.site
              , u = n.site
              , i = e.site;
            if (r !== i) {
                var o = u.x
                  , a = u.y
                  , c = r.x - o
                  , s = r.y - a
                  , l = i.x - o
                  , f = i.y - a
                  , h = 2 * (c * f - s * l);
                if (!(h >= -La)) {
                    var g = c * c + s * s
                      , p = l * l + f * f
                      , v = (f * g - s * p) / h
                      , d = (c * p - l * g) / h
                      , f = d + a
                      , m = Kc.pop() || new ar;
                    m.arc = n,
                    m.site = u,
                    m.x = v + o,
                    m.y = f + Math.sqrt(v * v + d * d),
                    m.cy = f,
                    n.circle = m;
                    for (var y = null, x = Jc._; x; )
                        if (m.y < x.y || m.y === x.y && m.x <= x.x) {
                            if (!x.L) {
                                y = x.P;
                                break
                            }
                            x = x.L
                        } else {
                            if (!x.R) {
                                y = x;
                                break
                            }
                            x = x.R
                        }
                    Jc.insert(y, m),
                    y || (Wc = m)
                }
            }
        }
    }
    function sr(n) {
        var t = n.circle;
        t && (t.P || (Wc = t.N),
        Jc.remove(t),
        Kc.push(t),
        yr(t),
        n.circle = null)
    }
    function lr(n) {
        for (var t, e = Xc, r = ue(n[0][0], n[0][1], n[1][0], n[1][1]), u = e.length; u--; )
            t = e[u],
            (!fr(t, n) || !r(t) || ca(t.a.x - t.b.x) < Na && ca(t.a.y - t.b.y) < Na) && (t.a = t.b = null,
            e.splice(u, 1))
    }
    function fr(n, t) {
        var e = n.b;
        if (e)
            return !0;
        var r, u, i = n.a, o = t[0][0], a = t[1][0], c = t[0][1], s = t[1][1], l = n.l, f = n.r, h = l.x, g = l.y, p = f.x, v = f.y, d = (h + p) / 2, m = (g + v) / 2;
        if (v === g) {
            if (o > d || d >= a)
                return;
            if (h > p) {
                if (i) {
                    if (i.y >= s)
                        return
                } else
                    i = {
                        x: d,
                        y: c
                    };
                e = {
                    x: d,
                    y: s
                }
            } else {
                if (i) {
                    if (i.y < c)
                        return
                } else
                    i = {
                        x: d,
                        y: s
                    };
                e = {
                    x: d,
                    y: c
                }
            }
        } else if (r = (h - p) / (v - g),
        u = m - r * d,
        -1 > r || r > 1)
            if (h > p) {
                if (i) {
                    if (i.y >= s)
                        return
                } else
                    i = {
                        x: (c - u) / r,
                        y: c
                    };
                e = {
                    x: (s - u) / r,
                    y: s
                }
            } else {
                if (i) {
                    if (i.y < c)
                        return
                } else
                    i = {
                        x: (s - u) / r,
                        y: s
                    };
                e = {
                    x: (c - u) / r,
                    y: c
                }
            }
        else if (v > g) {
            if (i) {
                if (i.x >= a)
                    return
            } else
                i = {
                    x: o,
                    y: r * o + u
                };
            e = {
                x: a,
                y: r * a + u
            }
        } else {
            if (i) {
                if (i.x < o)
                    return
            } else
                i = {
                    x: a,
                    y: r * a + u
                };
            e = {
                x: o,
                y: r * o + u
            }
        }
        return n.a = i,
        n.b = e,
        !0
    }
    function hr(n, t) {
        this.l = n,
        this.r = t,
        this.a = this.b = null
    }
    function gr(n, t, e, r) {
        var u = new hr(n,t);
        return Xc.push(u),
        e && vr(u, n, t, e),
        r && vr(u, t, n, r),
        $c[n.i].edges.push(new dr(u,n,t)),
        $c[t.i].edges.push(new dr(u,t,n)),
        u
    }
    function pr(n, t, e) {
        var r = new hr(n,null);
        return r.a = t,
        r.b = e,
        Xc.push(r),
        r
    }
    function vr(n, t, e, r) {
        n.a || n.b ? n.l === e ? n.b = r : n.a = r : (n.a = r,
        n.l = t,
        n.r = e)
    }
    function dr(n, t, e) {
        var r = n.a
          , u = n.b;
        this.edge = n,
        this.site = t,
        this.angle = e ? Math.atan2(e.y - t.y, e.x - t.x) : n.l === t ? Math.atan2(u.x - r.x, r.y - u.y) : Math.atan2(r.x - u.x, u.y - r.y)
    }
    function mr() {
        this._ = null
    }
    function yr(n) {
        n.U = n.C = n.L = n.R = n.P = n.N = null
    }
    function xr(n, t) {
        var e = t
          , r = t.R
          , u = e.U;
        u ? u.L === e ? u.L = r : u.R = r : n._ = r,
        r.U = u,
        e.U = r,
        e.R = r.L,
        e.R && (e.R.U = e),
        r.L = e
    }
    function Mr(n, t) {
        var e = t
          , r = t.L
          , u = e.U;
        u ? u.L === e ? u.L = r : u.R = r : n._ = r,
        r.U = u,
        e.U = r,
        e.L = r.R,
        e.L && (e.L.U = e),
        r.R = e
    }
    function _r(n) {
        for (; n.L; )
            n = n.L;
        return n
    }
    function br(n, t) {
        var e, r, u, i = n.sort(wr).pop();
        for (Xc = [],
        $c = new Array(n.length),
        Bc = new mr,
        Jc = new mr; ; )
            if (u = Wc,
            i && (!u || i.y < u.y || i.y === u.y && i.x < u.x))
                (i.x !== e || i.y !== r) && ($c[i.i] = new ur(i),
                tr(i),
                e = i.x,
                r = i.y),
                i = n.pop();
            else {
                if (!u)
                    break;
                nr(u.arc)
            }
        t && (lr(t),
        ir(t));
        var o = {
            cells: $c,
            edges: Xc
        };
        return Bc = Jc = Xc = $c = null,
        o
    }
    function wr(n, t) {
        return t.y - n.y || t.x - n.x
    }
    function Sr(n, t, e) {
        return (n.x - e.x) * (t.y - n.y) - (n.x - t.x) * (e.y - n.y)
    }
    function kr(n) {
        return n.x
    }
    function Er(n) {
        return n.y
    }
    function Ar() {
        return {
            leaf: !0,
            nodes: [],
            point: null,
            x: null,
            y: null
        }
    }
    function Cr(n, t, e, r, u, i) {
        if (!n(t, e, r, u, i)) {
            var o = .5 * (e + u)
              , a = .5 * (r + i)
              , c = t.nodes;
            c[0] && Cr(n, c[0], e, r, o, a),
            c[1] && Cr(n, c[1], o, r, u, a),
            c[2] && Cr(n, c[2], e, a, o, i),
            c[3] && Cr(n, c[3], o, a, u, i)
        }
    }
    function Nr(n, t) {
        n = Bo.rgb(n),
        t = Bo.rgb(t);
        var e = n.r
          , r = n.g
          , u = n.b
          , i = t.r - e
          , o = t.g - r
          , a = t.b - u;
        return function(n) {
            return "#" + st(Math.round(e + i * n)) + st(Math.round(r + o * n)) + st(Math.round(u + a * n))
        }
    }
    function Lr(n, t) {
        var e, r = {}, u = {};
        for (e in n)
            e in t ? r[e] = zr(n[e], t[e]) : u[e] = n[e];
        for (e in t)
            e in n || (u[e] = t[e]);
        return function(n) {
            for (e in r)
                u[e] = r[e](n);
            return u
        }
    }
    function Tr(n, t) {
        return t -= n = +n,
        function(e) {
            return n + t * e
        }
    }
    function qr(n, t) {
        var e, r, u, i, o, a = 0, c = 0, s = [], l = [];
        for (n += "",
        t += "",
        ns.lastIndex = 0,
        r = 0; e = ns.exec(t); ++r)
            e.index && s.push(t.substring(a, c = e.index)),
            l.push({
                i: s.length,
                x: e[0]
            }),
            s.push(null),
            a = ns.lastIndex;
        for (a < t.length && s.push(t.substring(a)),
        r = 0,
        i = l.length; (e = ns.exec(n)) && i > r; ++r)
            if (o = l[r],
            o.x == e[0]) {
                if (o.i)
                    if (null == s[o.i + 1])
                        for (s[o.i - 1] += o.x,
                        s.splice(o.i, 1),
                        u = r + 1; i > u; ++u)
                            l[u].i--;
                    else
                        for (s[o.i - 1] += o.x + s[o.i + 1],
                        s.splice(o.i, 2),
                        u = r + 1; i > u; ++u)
                            l[u].i -= 2;
                else if (null == s[o.i + 1])
                    s[o.i] = o.x;
                else
                    for (s[o.i] = o.x + s[o.i + 1],
                    s.splice(o.i + 1, 1),
                    u = r + 1; i > u; ++u)
                        l[u].i--;
                l.splice(r, 1),
                i--,
                r--
            } else
                o.x = Tr(parseFloat(e[0]), parseFloat(o.x));
        for (; i > r; )
            o = l.pop(),
            null == s[o.i + 1] ? s[o.i] = o.x : (s[o.i] = o.x + s[o.i + 1],
            s.splice(o.i + 1, 1)),
            i--;
        return 1 === s.length ? null == s[0] ? (o = l[0].x,
        function(n) {
            return o(n) + ""
        }
        ) : function() {
            return t
        }
        : function(n) {
            for (r = 0; i > r; ++r)
                s[(o = l[r]).i] = o.x(n);
            return s.join("")
        }
    }
    function zr(n, t) {
        for (var e, r = Bo.interpolators.length; --r >= 0 && !(e = Bo.interpolators[r](n, t)); )
            ;
        return e
    }
    function Rr(n, t) {
        var e, r = [], u = [], i = n.length, o = t.length, a = Math.min(n.length, t.length);
        for (e = 0; a > e; ++e)
            r.push(zr(n[e], t[e]));
        for (; i > e; ++e)
            u[e] = n[e];
        for (; o > e; ++e)
            u[e] = t[e];
        return function(n) {
            for (e = 0; a > e; ++e)
                u[e] = r[e](n);
            return u
        }
    }
    function Dr(n) {
        return function(t) {
            return 0 >= t ? 0 : t >= 1 ? 1 : n(t)
        }
    }
    function Pr(n) {
        return function(t) {
            return 1 - n(1 - t)
        }
    }
    function Ur(n) {
        return function(t) {
            return .5 * (.5 > t ? n(2 * t) : 2 - n(2 - 2 * t))
        }
    }
    function jr(n) {
        return n * n
    }
    function Hr(n) {
        return n * n * n
    }
    function Fr(n) {
        if (0 >= n)
            return 0;
        if (n >= 1)
            return 1;
        var t = n * n
          , e = t * n;
        return 4 * (.5 > n ? e : 3 * (n - t) + e - .75)
    }
    function Or(n) {
        return function(t) {
            return Math.pow(t, n)
        }
    }
    function Yr(n) {
        return 1 - Math.cos(n * Ca)
    }
    function Ir(n) {
        return Math.pow(2, 10 * (n - 1))
    }
    function Zr(n) {
        return 1 - Math.sqrt(1 - n * n)
    }
    function Vr(n, t) {
        var e;
        return arguments.length < 2 && (t = .45),
        arguments.length ? e = t / Aa * Math.asin(1 / n) : (n = 1,
        e = t / 4),
        function(r) {
            return 1 + n * Math.pow(2, -10 * r) * Math.sin((r - e) * Aa / t)
        }
    }
    function Xr(n) {
        return n || (n = 1.70158),
        function(t) {
            return t * t * ((n + 1) * t - n)
        }
    }
    function $r(n) {
        return 1 / 2.75 > n ? 7.5625 * n * n : 2 / 2.75 > n ? 7.5625 * (n -= 1.5 / 2.75) * n + .75 : 2.5 / 2.75 > n ? 7.5625 * (n -= 2.25 / 2.75) * n + .9375 : 7.5625 * (n -= 2.625 / 2.75) * n + .984375
    }
    function Br(n, t) {
        n = Bo.hcl(n),
        t = Bo.hcl(t);
        var e = n.h
          , r = n.c
          , u = n.l
          , i = t.h - e
          , o = t.c - r
          , a = t.l - u;
        return isNaN(o) && (o = 0,
        r = isNaN(r) ? t.c : r),
        isNaN(i) ? (i = 0,
        e = isNaN(e) ? t.h : e) : i > 180 ? i -= 360 : -180 > i && (i += 360),
        function(n) {
            return G(e + i * n, r + o * n, u + a * n) + ""
        }
    }
    function Wr(n, t) {
        n = Bo.hsl(n),
        t = Bo.hsl(t);
        var e = n.h
          , r = n.s
          , u = n.l
          , i = t.h - e
          , o = t.s - r
          , a = t.l - u;
        return isNaN(o) && (o = 0,
        r = isNaN(r) ? t.s : r),
        isNaN(i) ? (i = 0,
        e = isNaN(e) ? t.h : e) : i > 180 ? i -= 360 : -180 > i && (i += 360),
        function(n) {
            return B(e + i * n, r + o * n, u + a * n) + ""
        }
    }
    function Jr(n, t) {
        n = Bo.lab(n),
        t = Bo.lab(t);
        var e = n.l
          , r = n.a
          , u = n.b
          , i = t.l - e
          , o = t.a - r
          , a = t.b - u;
        return function(n) {
            return nt(e + i * n, r + o * n, u + a * n) + ""
        }
    }
    function Gr(n, t) {
        return t -= n,
        function(e) {
            return Math.round(n + t * e)
        }
    }
    function Kr(n) {
        var t = [n.a, n.b]
          , e = [n.c, n.d]
          , r = nu(t)
          , u = Qr(t, e)
          , i = nu(tu(e, t, -u)) || 0;
        t[0] * e[1] < e[0] * t[1] && (t[0] *= -1,
        t[1] *= -1,
        r *= -1,
        u *= -1),
        this.rotate = (r ? Math.atan2(t[1], t[0]) : Math.atan2(-e[0], e[1])) * qa,
        this.translate = [n.e, n.f],
        this.scale = [r, i],
        this.skew = i ? Math.atan2(u, i) * qa : 0
    }
    function Qr(n, t) {
        return n[0] * t[0] + n[1] * t[1]
    }
    function nu(n) {
        var t = Math.sqrt(Qr(n, n));
        return t && (n[0] /= t,
        n[1] /= t),
        t
    }
    function tu(n, t, e) {
        return n[0] += e * t[0],
        n[1] += e * t[1],
        n
    }
    function eu(n, t) {
        var e, r = [], u = [], i = Bo.transform(n), o = Bo.transform(t), a = i.translate, c = o.translate, s = i.rotate, l = o.rotate, f = i.skew, h = o.skew, g = i.scale, p = o.scale;
        return a[0] != c[0] || a[1] != c[1] ? (r.push("translate(", null, ",", null, ")"),
        u.push({
            i: 1,
            x: Tr(a[0], c[0])
        }, {
            i: 3,
            x: Tr(a[1], c[1])
        })) : c[0] || c[1] ? r.push("translate(" + c + ")") : r.push(""),
        s != l ? (s - l > 180 ? l += 360 : l - s > 180 && (s += 360),
        u.push({
            i: r.push(r.pop() + "rotate(", null, ")") - 2,
            x: Tr(s, l)
        })) : l && r.push(r.pop() + "rotate(" + l + ")"),
        f != h ? u.push({
            i: r.push(r.pop() + "skewX(", null, ")") - 2,
            x: Tr(f, h)
        }) : h && r.push(r.pop() + "skewX(" + h + ")"),
        g[0] != p[0] || g[1] != p[1] ? (e = r.push(r.pop() + "scale(", null, ",", null, ")"),
        u.push({
            i: e - 4,
            x: Tr(g[0], p[0])
        }, {
            i: e - 2,
            x: Tr(g[1], p[1])
        })) : (1 != p[0] || 1 != p[1]) && r.push(r.pop() + "scale(" + p + ")"),
        e = u.length,
        function(n) {
            for (var t, i = -1; ++i < e; )
                r[(t = u[i]).i] = t.x(n);
            return r.join("")
        }
    }
    function ru(n, t) {
        return t = t - (n = +n) ? 1 / (t - n) : 0,
        function(e) {
            return (e - n) * t
        }
    }
    function uu(n, t) {
        return t = t - (n = +n) ? 1 / (t - n) : 0,
        function(e) {
            return Math.max(0, Math.min(1, (e - n) * t))
        }
    }
    function iu(n) {
        for (var t = n.source, e = n.target, r = au(t, e), u = [t]; t !== r; )
            t = t.parent,
            u.push(t);
        for (var i = u.length; e !== r; )
            u.splice(i, 0, e),
            e = e.parent;
        return u
    }
    function ou(n) {
        for (var t = [], e = n.parent; null != e; )
            t.push(n),
            n = e,
            e = e.parent;
        return t.push(n),
        t
    }
    function au(n, t) {
        if (n === t)
            return n;
        for (var e = ou(n), r = ou(t), u = e.pop(), i = r.pop(), o = null; u === i; )
            o = u,
            u = e.pop(),
            i = r.pop();
        return o
    }
    function cu(n) {
        n.fixed |= 2
    }
    function su(n) {
        n.fixed &= -7
    }
    function lu(n) {
        n.fixed |= 4,
        n.px = n.x,
        n.py = n.y
    }
    function fu(n) {
        n.fixed &= -5
    }
    function hu(n, t, e) {
        var r = 0
          , u = 0;
        if (n.charge = 0,
        !n.leaf)
            for (var i, o = n.nodes, a = o.length, c = -1; ++c < a; )
                i = o[c],
                null != i && (hu(i, t, e),
                n.charge += i.charge,
                r += i.charge * i.cx,
                u += i.charge * i.cy);
        if (n.point) {
            n.leaf || (n.point.x += Math.random() - .5,
            n.point.y += Math.random() - .5);
            var s = t * e[n.point.index];
            n.charge += n.pointCharge = s,
            r += s * n.point.x,
            u += s * n.point.y
        }
        n.cx = r / n.charge,
        n.cy = u / n.charge
    }
    function gu(n, t) {
        return Bo.rebind(n, t, "sort", "children", "value"),
        n.nodes = n,
        n.links = mu,
        n
    }
    function pu(n) {
        return n.children
    }
    function vu(n) {
        return n.value
    }
    function du(n, t) {
        return t.value - n.value
    }
    function mu(n) {
        return Bo.merge(n.map(function(n) {
            return (n.children || []).map(function(t) {
                return {
                    source: n,
                    target: t
                }
            })
        }))
    }
    function yu(n) {
        return n.x
    }
    function xu(n) {
        return n.y
    }
    function Mu(n, t, e) {
        n.y0 = t,
        n.y = e
    }
    function _u(n) {
        return Bo.range(n.length)
    }
    function bu(n) {
        for (var t = -1, e = n[0].length, r = []; ++t < e; )
            r[t] = 0;
        return r
    }
    function wu(n) {
        for (var t, e = 1, r = 0, u = n[0][1], i = n.length; i > e; ++e)
            (t = n[e][1]) > u && (r = e,
            u = t);
        return r
    }
    function Su(n) {
        return n.reduce(ku, 0)
    }
    function ku(n, t) {
        return n + t[1]
    }
    function Eu(n, t) {
        return Au(n, Math.ceil(Math.log(t.length) / Math.LN2 + 1))
    }
    function Au(n, t) {
        for (var e = -1, r = +n[0], u = (n[1] - r) / t, i = []; ++e <= t; )
            i[e] = u * e + r;
        return i
    }
    function Cu(n) {
        return [Bo.min(n), Bo.max(n)]
    }
    function Nu(n, t) {
        return n.parent == t.parent ? 1 : 2
    }
    function Lu(n) {
        var t = n.children;
        return t && t.length ? t[0] : n._tree.thread
    }
    function Tu(n) {
        var t, e = n.children;
        return e && (t = e.length) ? e[t - 1] : n._tree.thread
    }
    function qu(n, t) {
        var e = n.children;
        if (e && (u = e.length))
            for (var r, u, i = -1; ++i < u; )
                t(r = qu(e[i], t), n) > 0 && (n = r);
        return n
    }
    function zu(n, t) {
        return n.x - t.x
    }
    function Ru(n, t) {
        return t.x - n.x
    }
    function Du(n, t) {
        return n.depth - t.depth
    }
    function Pu(n, t) {
        function e(n, r) {
            var u = n.children;
            if (u && (o = u.length))
                for (var i, o, a = null, c = -1; ++c < o; )
                    i = u[c],
                    e(i, a),
                    a = i;
            t(n, r)
        }
        e(n, null)
    }
    function Uu(n) {
        for (var t, e = 0, r = 0, u = n.children, i = u.length; --i >= 0; )
            t = u[i]._tree,
            t.prelim += e,
            t.mod += e,
            e += t.shift + (r += t.change)
    }
    function ju(n, t, e) {
        n = n._tree,
        t = t._tree;
        var r = e / (t.number - n.number);
        n.change += r,
        t.change -= r,
        t.shift += e,
        t.prelim += e,
        t.mod += e
    }
    function Hu(n, t, e) {
        return n._tree.ancestor.parent == t.parent ? n._tree.ancestor : e
    }
    function Fu(n, t) {
        return n.value - t.value
    }
    function Ou(n, t) {
        var e = n._pack_next;
        n._pack_next = t,
        t._pack_prev = n,
        t._pack_next = e,
        e._pack_prev = t
    }
    function Yu(n, t) {
        n._pack_next = t,
        t._pack_prev = n
    }
    function Iu(n, t) {
        var e = t.x - n.x
          , r = t.y - n.y
          , u = n.r + t.r;
        return .999 * u * u > e * e + r * r
    }
    function Zu(n) {
        function t(n) {
            l = Math.min(n.x - n.r, l),
            f = Math.max(n.x + n.r, f),
            h = Math.min(n.y - n.r, h),
            g = Math.max(n.y + n.r, g)
        }
        if ((e = n.children) && (s = e.length)) {
            var e, r, u, i, o, a, c, s, l = 1 / 0, f = -1 / 0, h = 1 / 0, g = -1 / 0;
            if (e.forEach(Vu),
            r = e[0],
            r.x = -r.r,
            r.y = 0,
            t(r),
            s > 1 && (u = e[1],
            u.x = u.r,
            u.y = 0,
            t(u),
            s > 2))
                for (i = e[2],
                Bu(r, u, i),
                t(i),
                Ou(r, i),
                r._pack_prev = i,
                Ou(i, u),
                u = r._pack_next,
                o = 3; s > o; o++) {
                    Bu(r, u, i = e[o]);
                    var p = 0
                      , v = 1
                      , d = 1;
                    for (a = u._pack_next; a !== u; a = a._pack_next,
                    v++)
                        if (Iu(a, i)) {
                            p = 1;
                            break
                        }
                    if (1 == p)
                        for (c = r._pack_prev; c !== a._pack_prev && !Iu(c, i); c = c._pack_prev,
                        d++)
                            ;
                    p ? (d > v || v == d && u.r < r.r ? Yu(r, u = a) : Yu(r = c, u),
                    o--) : (Ou(r, i),
                    u = i,
                    t(i))
                }
            var m = (l + f) / 2
              , y = (h + g) / 2
              , x = 0;
            for (o = 0; s > o; o++)
                i = e[o],
                i.x -= m,
                i.y -= y,
                x = Math.max(x, i.r + Math.sqrt(i.x * i.x + i.y * i.y));
            n.r = x,
            e.forEach(Xu)
        }
    }
    function Vu(n) {
        n._pack_next = n._pack_prev = n
    }
    function Xu(n) {
        delete n._pack_next,
        delete n._pack_prev
    }
    function $u(n, t, e, r) {
        var u = n.children;
        if (n.x = t += r * n.x,
        n.y = e += r * n.y,
        n.r *= r,
        u)
            for (var i = -1, o = u.length; ++i < o; )
                $u(u[i], t, e, r)
    }
    function Bu(n, t, e) {
        var r = n.r + e.r
          , u = t.x - n.x
          , i = t.y - n.y;
        if (r && (u || i)) {
            var o = t.r + e.r
              , a = u * u + i * i;
            o *= o,
            r *= r;
            var c = .5 + (r - o) / (2 * a)
              , s = Math.sqrt(Math.max(0, 2 * o * (r + a) - (r -= a) * r - o * o)) / (2 * a);
            e.x = n.x + c * u + s * i,
            e.y = n.y + c * i - s * u
        } else
            e.x = n.x + r,
            e.y = n.y
    }
    function Wu(n) {
        return 1 + Bo.max(n, function(n) {
            return n.y
        })
    }
    function Ju(n) {
        return n.reduce(function(n, t) {
            return n + t.x
        }, 0) / n.length
    }
    function Gu(n) {
        var t = n.children;
        return t && t.length ? Gu(t[0]) : n
    }
    function Ku(n) {
        var t, e = n.children;
        return e && (t = e.length) ? Ku(e[t - 1]) : n
    }
    function Qu(n) {
        return {
            x: n.x,
            y: n.y,
            dx: n.dx,
            dy: n.dy
        }
    }
    function ni(n, t) {
        var e = n.x + t[3]
          , r = n.y + t[0]
          , u = n.dx - t[1] - t[3]
          , i = n.dy - t[0] - t[2];
        return 0 > u && (e += u / 2,
        u = 0),
        0 > i && (r += i / 2,
        i = 0),
        {
            x: e,
            y: r,
            dx: u,
            dy: i
        }
    }
    function ti(n) {
        var t = n[0]
          , e = n[n.length - 1];
        return e > t ? [t, e] : [e, t]
    }
    function ei(n) {
        return n.rangeExtent ? n.rangeExtent() : ti(n.range())
    }
    function ri(n, t, e, r) {
        var u = e(n[0], n[1])
          , i = r(t[0], t[1]);
        return function(n) {
            return i(u(n))
        }
    }
    function ui(n, t) {
        var e, r = 0, u = n.length - 1, i = n[r], o = n[u];
        return i > o && (e = r,
        r = u,
        u = e,
        e = i,
        i = o,
        o = e),
        n[r] = t.floor(i),
        n[u] = t.ceil(o),
        n
    }
    function ii(n) {
        return n ? {
            floor: function(t) {
                return Math.floor(t / n) * n
            },
            ceil: function(t) {
                return Math.ceil(t / n) * n
            }
        } : ls
    }
    function oi(n, t, e, r) {
        var u = []
          , i = []
          , o = 0
          , a = Math.min(n.length, t.length) - 1;
        for (n[a] < n[0] && (n = n.slice().reverse(),
        t = t.slice().reverse()); ++o <= a; )
            u.push(e(n[o - 1], n[o])),
            i.push(r(t[o - 1], t[o]));
        return function(t) {
            var e = Bo.bisect(n, t, 1, a) - 1;
            return i[e](u[e](t))
        }
    }
    function ai(n, t, e, r) {
        function u() {
            var u = Math.min(n.length, t.length) > 2 ? oi : ri
              , c = r ? uu : ru;
            return o = u(n, t, c, e),
            a = u(t, n, c, zr),
            i
        }
        function i(n) {
            return o(n)
        }
        var o, a;
        return i.invert = function(n) {
            return a(n)
        }
        ,
        i.domain = function(t) {
            return arguments.length ? (n = t.map(Number),
            u()) : n
        }
        ,
        i.range = function(n) {
            return arguments.length ? (t = n,
            u()) : t
        }
        ,
        i.rangeRound = function(n) {
            return i.range(n).interpolate(Gr)
        }
        ,
        i.clamp = function(n) {
            return arguments.length ? (r = n,
            u()) : r
        }
        ,
        i.interpolate = function(n) {
            return arguments.length ? (e = n,
            u()) : e
        }
        ,
        i.ticks = function(t) {
            return fi(n, t)
        }
        ,
        i.tickFormat = function(t, e) {
            return hi(n, t, e)
        }
        ,
        i.nice = function(t) {
            return si(n, t),
            u()
        }
        ,
        i.copy = function() {
            return ai(n, t, e, r)
        }
        ,
        u()
    }
    function ci(n, t) {
        return Bo.rebind(n, t, "range", "rangeRound", "interpolate", "clamp")
    }
    function si(n, t) {
        return ui(n, ii(li(n, t)[2]))
    }
    function li(n, t) {
        null == t && (t = 10);
        var e = ti(n)
          , r = e[1] - e[0]
          , u = Math.pow(10, Math.floor(Math.log(r / t) / Math.LN10))
          , i = t / r * u;
        return .15 >= i ? u *= 10 : .35 >= i ? u *= 5 : .75 >= i && (u *= 2),
        e[0] = Math.ceil(e[0] / u) * u,
        e[1] = Math.floor(e[1] / u) * u + .5 * u,
        e[2] = u,
        e
    }
    function fi(n, t) {
        return Bo.range.apply(Bo, li(n, t))
    }
    function hi(n, t, e) {
        var r = li(n, t);
        return Bo.format(e ? e.replace(ic, function(n, t, e, u, i, o, a, c, s, l) {
            return [t, e, u, i, o, a, c, s || "." + pi(l, r), l].join("")
        }) : ",." + gi(r[2]) + "f")
    }
    function gi(n) {
        return -Math.floor(Math.log(n) / Math.LN10 + .01)
    }
    function pi(n, t) {
        var e = gi(t[2]);
        return n in fs ? Math.abs(e - gi(Math.max(Math.abs(t[0]), Math.abs(t[1])))) + +("e" !== n) : e - 2 * ("%" === n)
    }
    function vi(n, t, e, r) {
        function u(n) {
            return (e ? Math.log(0 > n ? 0 : n) : -Math.log(n > 0 ? 0 : -n)) / Math.log(t)
        }
        function i(n) {
            return e ? Math.pow(t, n) : -Math.pow(t, -n)
        }
        function o(t) {
            return n(u(t))
        }
        return o.invert = function(t) {
            return i(n.invert(t))
        }
        ,
        o.domain = function(t) {
            return arguments.length ? (e = t[0] >= 0,
            n.domain((r = t.map(Number)).map(u)),
            o) : r
        }
        ,
        o.base = function(e) {
            return arguments.length ? (t = +e,
            n.domain(r.map(u)),
            o) : t
        }
        ,
        o.nice = function() {
            var t = ui(r.map(u), e ? Math : gs);
            return n.domain(t),
            r = t.map(i),
            o
        }
        ,
        o.ticks = function() {
            var n = ti(r)
              , o = []
              , a = n[0]
              , c = n[1]
              , s = Math.floor(u(a))
              , l = Math.ceil(u(c))
              , f = t % 1 ? 2 : t;
            if (isFinite(l - s)) {
                if (e) {
                    for (; l > s; s++)
                        for (var h = 1; f > h; h++)
                            o.push(i(s) * h);
                    o.push(i(s))
                } else
                    for (o.push(i(s)); s++ < l; )
                        for (var h = f - 1; h > 0; h--)
                            o.push(i(s) * h);
                for (s = 0; o[s] < a; s++)
                    ;
                for (l = o.length; o[l - 1] > c; l--)
                    ;
                o = o.slice(s, l)
            }
            return o
        }
        ,
        o.tickFormat = function(n, t) {
            if (!arguments.length)
                return hs;
            arguments.length < 2 ? t = hs : "function" != typeof t && (t = Bo.format(t));
            var r, a = Math.max(.1, n / o.ticks().length), c = e ? (r = 1e-12,
            Math.ceil) : (r = -1e-12,
            Math.floor);
            return function(n) {
                return n / i(c(u(n) + r)) <= a ? t(n) : ""
            }
        }
        ,
        o.copy = function() {
            return vi(n.copy(), t, e, r)
        }
        ,
        ci(o, n)
    }
    function di(n, t, e) {
        function r(t) {
            return n(u(t))
        }
        var u = mi(t)
          , i = mi(1 / t);
        return r.invert = function(t) {
            return i(n.invert(t))
        }
        ,
        r.domain = function(t) {
            return arguments.length ? (n.domain((e = t.map(Number)).map(u)),
            r) : e
        }
        ,
        r.ticks = function(n) {
            return fi(e, n)
        }
        ,
        r.tickFormat = function(n, t) {
            return hi(e, n, t)
        }
        ,
        r.nice = function(n) {
            return r.domain(si(e, n))
        }
        ,
        r.exponent = function(o) {
            return arguments.length ? (u = mi(t = o),
            i = mi(1 / t),
            n.domain(e.map(u)),
            r) : t
        }
        ,
        r.copy = function() {
            return di(n.copy(), t, e)
        }
        ,
        ci(r, n)
    }
    function mi(n) {
        return function(t) {
            return 0 > t ? -Math.pow(-t, n) : Math.pow(t, n)
        }
    }
    function yi(n, t) {
        function e(e) {
            return o[((i.get(e) || "range" === t.t && i.set(e, n.push(e))) - 1) % o.length]
        }
        function r(t, e) {
            return Bo.range(n.length).map(function(n) {
                return t + e * n
            })
        }
        var i, o, a;
        return e.domain = function(r) {
            if (!arguments.length)
                return n;
            n = [],
            i = new u;
            for (var o, a = -1, c = r.length; ++a < c; )
                i.has(o = r[a]) || i.set(o, n.push(o));
            return e[t.t].apply(e, t.a)
        }
        ,
        e.range = function(n) {
            return arguments.length ? (o = n,
            a = 0,
            t = {
                t: "range",
                a: arguments
            },
            e) : o
        }
        ,
        e.rangePoints = function(u, i) {
            arguments.length < 2 && (i = 0);
            var c = u[0]
              , s = u[1]
              , l = (s - c) / (Math.max(1, n.length - 1) + i);
            return o = r(n.length < 2 ? (c + s) / 2 : c + l * i / 2, l),
            a = 0,
            t = {
                t: "rangePoints",
                a: arguments
            },
            e
        }
        ,
        e.rangeBands = function(u, i, c) {
            arguments.length < 2 && (i = 0),
            arguments.length < 3 && (c = i);
            var s = u[1] < u[0]
              , l = u[s - 0]
              , f = u[1 - s]
              , h = (f - l) / (n.length - i + 2 * c);
            return o = r(l + h * c, h),
            s && o.reverse(),
            a = h * (1 - i),
            t = {
                t: "rangeBands",
                a: arguments
            },
            e
        }
        ,
        e.rangeRoundBands = function(u, i, c) {
            arguments.length < 2 && (i = 0),
            arguments.length < 3 && (c = i);
            var s = u[1] < u[0]
              , l = u[s - 0]
              , f = u[1 - s]
              , h = Math.floor((f - l) / (n.length - i + 2 * c))
              , g = f - l - (n.length - i) * h;
            return o = r(l + Math.round(g / 2), h),
            s && o.reverse(),
            a = Math.round(h * (1 - i)),
            t = {
                t: "rangeRoundBands",
                a: arguments
            },
            e
        }
        ,
        e.rangeBand = function() {
            return a
        }
        ,
        e.rangeExtent = function() {
            return ti(t.a[0])
        }
        ,
        e.copy = function() {
            return yi(n, t)
        }
        ,
        e.domain(n)
    }
    function xi(n, t) {
        function e() {
            var e = 0
              , i = t.length;
            for (u = []; ++e < i; )
                u[e - 1] = Bo.quantile(n, e / i);
            return r
        }
        function r(n) {
            return isNaN(n = +n) ? void 0 : t[Bo.bisect(u, n)]
        }
        var u;
        return r.domain = function(t) {
            return arguments.length ? (n = t.filter(function(n) {
                return !isNaN(n)
            }).sort(Bo.ascending),
            e()) : n
        }
        ,
        r.range = function(n) {
            return arguments.length ? (t = n,
            e()) : t
        }
        ,
        r.quantiles = function() {
            return u
        }
        ,
        r.invertExtent = function(e) {
            return e = t.indexOf(e),
            0 > e ? [0 / 0, 0 / 0] : [e > 0 ? u[e - 1] : n[0], e < u.length ? u[e] : n[n.length - 1]]
        }
        ,
        r.copy = function() {
            return xi(n, t)
        }
        ,
        e()
    }
    function Mi(n, t, e) {
        function r(t) {
            return e[Math.max(0, Math.min(o, Math.floor(i * (t - n))))]
        }
        function u() {
            return i = e.length / (t - n),
            o = e.length - 1,
            r
        }
        var i, o;
        return r.domain = function(e) {
            return arguments.length ? (n = +e[0],
            t = +e[e.length - 1],
            u()) : [n, t]
        }
        ,
        r.range = function(n) {
            return arguments.length ? (e = n,
            u()) : e
        }
        ,
        r.invertExtent = function(t) {
            return t = e.indexOf(t),
            t = 0 > t ? 0 / 0 : t / i + n,
            [t, t + 1 / i]
        }
        ,
        r.copy = function() {
            return Mi(n, t, e)
        }
        ,
        u()
    }
    function _i(n, t) {
        function e(e) {
            return e >= e ? t[Bo.bisect(n, e)] : void 0
        }
        return e.domain = function(t) {
            return arguments.length ? (n = t,
            e) : n
        }
        ,
        e.range = function(n) {
            return arguments.length ? (t = n,
            e) : t
        }
        ,
        e.invertExtent = function(e) {
            return e = t.indexOf(e),
            [n[e - 1], n[e]]
        }
        ,
        e.copy = function() {
            return _i(n, t)
        }
        ,
        e
    }
    function bi(n) {
        function t(n) {
            return +n
        }
        return t.invert = t,
        t.domain = t.range = function(e) {
            return arguments.length ? (n = e.map(t),
            t) : n
        }
        ,
        t.ticks = function(t) {
            return fi(n, t)
        }
        ,
        t.tickFormat = function(t, e) {
            return hi(n, t, e)
        }
        ,
        t.copy = function() {
            return bi(n)
        }
        ,
        t
    }
    function wi(n) {
        return n.innerRadius
    }
    function Si(n) {
        return n.outerRadius
    }
    function ki(n) {
        return n.startAngle
    }
    function Ei(n) {
        return n.endAngle
    }
    function Ai(n) {
        function t(t) {
            function o() {
                s.push("M", i(n(l), a))
            }
            for (var c, s = [], l = [], f = -1, h = t.length, g = vt(e), p = vt(r); ++f < h; )
                u.call(this, c = t[f], f) ? l.push([+g.call(this, c, f), +p.call(this, c, f)]) : l.length && (o(),
                l = []);
            return l.length && o(),
            s.length ? s.join("") : null
        }
        var e = Ve
          , r = Xe
          , u = Vt
          , i = Ci
          , o = i.key
          , a = .7;
        return t.x = function(n) {
            return arguments.length ? (e = n,
            t) : e
        }
        ,
        t.y = function(n) {
            return arguments.length ? (r = n,
            t) : r
        }
        ,
        t.defined = function(n) {
            return arguments.length ? (u = n,
            t) : u
        }
        ,
        t.interpolate = function(n) {
            return arguments.length ? (o = "function" == typeof n ? i = n : (i = Ms.get(n) || Ci).key,
            t) : o
        }
        ,
        t.tension = function(n) {
            return arguments.length ? (a = n,
            t) : a
        }
        ,
        t
    }
    function Ci(n) {
        return n.join("L")
    }
    function Ni(n) {
        return Ci(n) + "Z"
    }
    function Li(n) {
        for (var t = 0, e = n.length, r = n[0], u = [r[0], ",", r[1]]; ++t < e; )
            u.push("H", (r[0] + (r = n[t])[0]) / 2, "V", r[1]);
        return e > 1 && u.push("H", r[0]),
        u.join("")
    }
    function Ti(n) {
        for (var t = 0, e = n.length, r = n[0], u = [r[0], ",", r[1]]; ++t < e; )
            u.push("V", (r = n[t])[1], "H", r[0]);
        return u.join("")
    }
    function qi(n) {
        for (var t = 0, e = n.length, r = n[0], u = [r[0], ",", r[1]]; ++t < e; )
            u.push("H", (r = n[t])[0], "V", r[1]);
        return u.join("")
    }
    function zi(n, t) {
        return n.length < 4 ? Ci(n) : n[1] + Pi(n.slice(1, n.length - 1), Ui(n, t))
    }
    function Ri(n, t) {
        return n.length < 3 ? Ci(n) : n[0] + Pi((n.push(n[0]),
        n), Ui([n[n.length - 2]].concat(n, [n[1]]), t))
    }
    function Di(n, t) {
        return n.length < 3 ? Ci(n) : n[0] + Pi(n, Ui(n, t))
    }
    function Pi(n, t) {
        if (t.length < 1 || n.length != t.length && n.length != t.length + 2)
            return Ci(n);
        var e = n.length != t.length
          , r = ""
          , u = n[0]
          , i = n[1]
          , o = t[0]
          , a = o
          , c = 1;
        if (e && (r += "Q" + (i[0] - 2 * o[0] / 3) + "," + (i[1] - 2 * o[1] / 3) + "," + i[0] + "," + i[1],
        u = n[1],
        c = 2),
        t.length > 1) {
            a = t[1],
            i = n[c],
            c++,
            r += "C" + (u[0] + o[0]) + "," + (u[1] + o[1]) + "," + (i[0] - a[0]) + "," + (i[1] - a[1]) + "," + i[0] + "," + i[1];
            for (var s = 2; s < t.length; s++,
            c++)
                i = n[c],
                a = t[s],
                r += "S" + (i[0] - a[0]) + "," + (i[1] - a[1]) + "," + i[0] + "," + i[1]
        }
        if (e) {
            var l = n[c];
            r += "Q" + (i[0] + 2 * a[0] / 3) + "," + (i[1] + 2 * a[1] / 3) + "," + l[0] + "," + l[1]
        }
        return r
    }
    function Ui(n, t) {
        for (var e, r = [], u = (1 - t) / 2, i = n[0], o = n[1], a = 1, c = n.length; ++a < c; )
            e = i,
            i = o,
            o = n[a],
            r.push([u * (o[0] - e[0]), u * (o[1] - e[1])]);
        return r
    }
    function ji(n) {
        if (n.length < 3)
            return Ci(n);
        var t = 1
          , e = n.length
          , r = n[0]
          , u = r[0]
          , i = r[1]
          , o = [u, u, u, (r = n[1])[0]]
          , a = [i, i, i, r[1]]
          , c = [u, ",", i, "L", Yi(ws, o), ",", Yi(ws, a)];
        for (n.push(n[e - 1]); ++t <= e; )
            r = n[t],
            o.shift(),
            o.push(r[0]),
            a.shift(),
            a.push(r[1]),
            Ii(c, o, a);
        return n.pop(),
        c.push("L", r),
        c.join("")
    }
    function Hi(n) {
        if (n.length < 4)
            return Ci(n);
        for (var t, e = [], r = -1, u = n.length, i = [0], o = [0]; ++r < 3; )
            t = n[r],
            i.push(t[0]),
            o.push(t[1]);
        for (e.push(Yi(ws, i) + "," + Yi(ws, o)),
        --r; ++r < u; )
            t = n[r],
            i.shift(),
            i.push(t[0]),
            o.shift(),
            o.push(t[1]),
            Ii(e, i, o);
        return e.join("")
    }
    function Fi(n) {
        for (var t, e, r = -1, u = n.length, i = u + 4, o = [], a = []; ++r < 4; )
            e = n[r % u],
            o.push(e[0]),
            a.push(e[1]);
        for (t = [Yi(ws, o), ",", Yi(ws, a)],
        --r; ++r < i; )
            e = n[r % u],
            o.shift(),
            o.push(e[0]),
            a.shift(),
            a.push(e[1]),
            Ii(t, o, a);
        return t.join("")
    }
    function Oi(n, t) {
        var e = n.length - 1;
        if (e)
            for (var r, u, i = n[0][0], o = n[0][1], a = n[e][0] - i, c = n[e][1] - o, s = -1; ++s <= e; )
                r = n[s],
                u = s / e,
                r[0] = t * r[0] + (1 - t) * (i + u * a),
                r[1] = t * r[1] + (1 - t) * (o + u * c);
        return ji(n)
    }
    function Yi(n, t) {
        return n[0] * t[0] + n[1] * t[1] + n[2] * t[2] + n[3] * t[3]
    }
    function Ii(n, t, e) {
        n.push("C", Yi(_s, t), ",", Yi(_s, e), ",", Yi(bs, t), ",", Yi(bs, e), ",", Yi(ws, t), ",", Yi(ws, e))
    }
    function Zi(n, t) {
        return (t[1] - n[1]) / (t[0] - n[0])
    }
    function Vi(n) {
        for (var t = 0, e = n.length - 1, r = [], u = n[0], i = n[1], o = r[0] = Zi(u, i); ++t < e; )
            r[t] = (o + (o = Zi(u = i, i = n[t + 1]))) / 2;
        return r[t] = o,
        r
    }
    function Xi(n) {
        for (var t, e, r, u, i = [], o = Vi(n), a = -1, c = n.length - 1; ++a < c; )
            t = Zi(n[a], n[a + 1]),
            ca(t) < Na ? o[a] = o[a + 1] = 0 : (e = o[a] / t,
            r = o[a + 1] / t,
            u = e * e + r * r,
            u > 9 && (u = 3 * t / Math.sqrt(u),
            o[a] = u * e,
            o[a + 1] = u * r));
        for (a = -1; ++a <= c; )
            u = (n[Math.min(c, a + 1)][0] - n[Math.max(0, a - 1)][0]) / (6 * (1 + o[a] * o[a])),
            i.push([u || 0, o[a] * u || 0]);
        return i
    }
    function $i(n) {
        return n.length < 3 ? Ci(n) : n[0] + Pi(n, Xi(n))
    }
    function Bi(n) {
        for (var t, e, r, u = -1, i = n.length; ++u < i; )
            t = n[u],
            e = t[0],
            r = t[1] + ys,
            t[0] = e * Math.cos(r),
            t[1] = e * Math.sin(r);
        return n
    }
    function Wi(n) {
        function t(t) {
            function c() {
                v.push("M", a(n(m), f), l, s(n(d.reverse()), f), "Z")
            }
            for (var h, g, p, v = [], d = [], m = [], y = -1, x = t.length, M = vt(e), _ = vt(u), b = e === r ? function() {
                return g
            }
            : vt(r), w = u === i ? function() {
                return p
            }
            : vt(i); ++y < x; )
                o.call(this, h = t[y], y) ? (d.push([g = +M.call(this, h, y), p = +_.call(this, h, y)]),
                m.push([+b.call(this, h, y), +w.call(this, h, y)])) : d.length && (c(),
                d = [],
                m = []);
            return d.length && c(),
            v.length ? v.join("") : null
        }
        var e = Ve
          , r = Ve
          , u = 0
          , i = Xe
          , o = Vt
          , a = Ci
          , c = a.key
          , s = a
          , l = "L"
          , f = .7;
        return t.x = function(n) {
            return arguments.length ? (e = r = n,
            t) : r
        }
        ,
        t.x0 = function(n) {
            return arguments.length ? (e = n,
            t) : e
        }
        ,
        t.x1 = function(n) {
            return arguments.length ? (r = n,
            t) : r
        }
        ,
        t.y = function(n) {
            return arguments.length ? (u = i = n,
            t) : i
        }
        ,
        t.y0 = function(n) {
            return arguments.length ? (u = n,
            t) : u
        }
        ,
        t.y1 = function(n) {
            return arguments.length ? (i = n,
            t) : i
        }
        ,
        t.defined = function(n) {
            return arguments.length ? (o = n,
            t) : o
        }
        ,
        t.interpolate = function(n) {
            return arguments.length ? (c = "function" == typeof n ? a = n : (a = Ms.get(n) || Ci).key,
            s = a.reverse || a,
            l = a.closed ? "M" : "L",
            t) : c
        }
        ,
        t.tension = function(n) {
            return arguments.length ? (f = n,
            t) : f
        }
        ,
        t
    }
    function Ji(n) {
        return n.radius
    }
    function Gi(n) {
        return [n.x, n.y]
    }
    function Ki(n) {
        return function() {
            var t = n.apply(this, arguments)
              , e = t[0]
              , r = t[1] + ys;
            return [e * Math.cos(r), e * Math.sin(r)]
        }
    }
    function Qi() {
        return 64
    }
    function no() {
        return "circle"
    }
    function to(n) {
        var t = Math.sqrt(n / Ea);
        return "M0," + t + "A" + t + "," + t + " 0 1,1 0," + -t + "A" + t + "," + t + " 0 1,1 0," + t + "Z"
    }
    function eo(n, t) {
        return ga(n, Ns),
        n.id = t,
        n
    }
    function ro(n, t, e, r) {
        var u = n.id;
        return N(n, "function" == typeof e ? function(n, i, o) {
            n.__transition__[u].tween.set(t, r(e.call(n, n.__data__, i, o)))
        }
        : (e = r(e),
        function(n) {
            n.__transition__[u].tween.set(t, e)
        }
        ))
    }
    function uo(n) {
        return null == n && (n = ""),
        function() {
            this.textContent = n
        }
    }
    function io(n, t, e, r) {
        var i = n.__transition__ || (n.__transition__ = {
            active: 0,
            count: 0
        })
          , o = i[e];
        if (!o) {
            var a = r.time;
            o = i[e] = {
                tween: new u,
                time: a,
                ease: r.ease,
                delay: r.delay,
                duration: r.duration
            },
            ++i.count,
            Bo.timer(function(r) {
                function u(r) {
                    return i.active > e ? s() : (i.active = e,
                    o.event && o.event.start.call(n, l, t),
                    o.tween.forEach(function(e, r) {
                        (r = r.call(n, l, t)) && v.push(r)
                    }),
                    Bo.timer(function() {
                        return p.c = c(r || 1) ? Vt : c,
                        1
                    }, 0, a),
                    void 0)
                }
                function c(r) {
                    if (i.active !== e)
                        return s();
                    for (var u = r / g, a = f(u), c = v.length; c > 0; )
                        v[--c].call(n, a);
                    return u >= 1 ? (o.event && o.event.end.call(n, l, t),
                    s()) : void 0
                }
                function s() {
                    return --i.count ? delete i[e] : delete n.__transition__,
                    1
                }
                var l = n.__data__
                  , f = o.ease
                  , h = o.delay
                  , g = o.duration
                  , p = Ka
                  , v = [];
                return p.t = h + a,
                r >= h ? u(r - h) : (p.c = u,
                void 0)
            }, 0, a)
        }
    }
    function oo(n, t) {
        n.attr("transform", function(n) {
            return "translate(" + t(n) + ",0)"
        })
    }
    function ao(n, t) {
        n.attr("transform", function(n) {
            return "translate(0," + t(n) + ")"
        })
    }
    function co() {
        this._ = new Date(arguments.length > 1 ? Date.UTC.apply(this, arguments) : arguments[0])
    }
    function so(n, t, e) {
        function r(t) {
            var e = n(t)
              , r = i(e, 1);
            return r - t > t - e ? e : r
        }
        function u(e) {
            return t(e = n(new Ps(e - 1)), 1),
            e
        }
        function i(n, e) {
            return t(n = new Ps(+n), e),
            n
        }
        function o(n, r, i) {
            var o = u(n)
              , a = [];
            if (i > 1)
                for (; r > o; )
                    e(o) % i || a.push(new Date(+o)),
                    t(o, 1);
            else
                for (; r > o; )
                    a.push(new Date(+o)),
                    t(o, 1);
            return a
        }
        function a(n, t, e) {
            try {
                Ps = co;
                var r = new co;
                return r._ = n,
                o(r, t, e)
            } finally {
                Ps = Date
            }
        }
        n.floor = n,
        n.round = r,
        n.ceil = u,
        n.offset = i,
        n.range = o;
        var c = n.utc = lo(n);
        return c.floor = c,
        c.round = lo(r),
        c.ceil = lo(u),
        c.offset = lo(i),
        c.range = a,
        n
    }
    function lo(n) {
        return function(t, e) {
            try {
                Ps = co;
                var r = new co;
                return r._ = t,
                n(r, e)._
            } finally {
                Ps = Date
            }
        }
    }
    function fo(n) {
        function t(t) {
            for (var r, u, i, o = [], a = -1, c = 0; ++a < e; )
                37 === n.charCodeAt(a) && (o.push(n.substring(c, a)),
                null != (u = tl[r = n.charAt(++a)]) && (r = n.charAt(++a)),
                (i = el[r]) && (r = i(t, null == u ? "e" === r ? " " : "0" : u)),
                o.push(r),
                c = a + 1);
            return o.push(n.substring(c, a)),
            o.join("")
        }
        var e = n.length;
        return t.parse = function(t) {
            var e = {
                y: 1900,
                m: 0,
                d: 1,
                H: 0,
                M: 0,
                S: 0,
                L: 0,
                Z: null
            }
              , r = ho(e, n, t, 0);
            if (r != t.length)
                return null;
            "p"in e && (e.H = e.H % 12 + 12 * e.p);
            var u = null != e.Z && Ps !== co
              , i = new (u ? co : Ps);
            return "j"in e ? i.setFullYear(e.y, 0, e.j) : "w"in e && ("W"in e || "U"in e) ? (i.setFullYear(e.y, 0, 1),
            i.setFullYear(e.y, 0, "W"in e ? (e.w + 6) % 7 + 7 * e.W - (i.getDay() + 5) % 7 : e.w + 7 * e.U - (i.getDay() + 6) % 7)) : i.setFullYear(e.y, e.m, e.d),
            i.setHours(e.H + Math.floor(e.Z / 100), e.M + e.Z % 100, e.S, e.L),
            u ? i._ : i
        }
        ,
        t.toString = function() {
            return n
        }
        ,
        t
    }
    function ho(n, t, e, r) {
        for (var u, i, o, a = 0, c = t.length, s = e.length; c > a; ) {
            if (r >= s)
                return -1;
            if (u = t.charCodeAt(a++),
            37 === u) {
                if (o = t.charAt(a++),
                i = rl[o in tl ? t.charAt(a++) : o],
                !i || (r = i(n, e, r)) < 0)
                    return -1
            } else if (u != e.charCodeAt(r++))
                return -1
        }
        return r
    }
    function go(n) {
        return new RegExp("^(?:" + n.map(Bo.requote).join("|") + ")","i")
    }
    function po(n) {
        for (var t = new u, e = -1, r = n.length; ++e < r; )
            t.set(n[e].toLowerCase(), e);
        return t
    }
    function vo(n, t, e) {
        var r = 0 > n ? "-" : ""
          , u = (r ? -n : n) + ""
          , i = u.length;
        return r + (e > i ? new Array(e - i + 1).join(t) + u : u)
    }
    function mo(n, t, e) {
        Bs.lastIndex = 0;
        var r = Bs.exec(t.substring(e));
        return r ? (n.w = Ws.get(r[0].toLowerCase()),
        e + r[0].length) : -1
    }
    function yo(n, t, e) {
        Xs.lastIndex = 0;
        var r = Xs.exec(t.substring(e));
        return r ? (n.w = $s.get(r[0].toLowerCase()),
        e + r[0].length) : -1
    }
    function xo(n, t, e) {
        ul.lastIndex = 0;
        var r = ul.exec(t.substring(e, e + 1));
        return r ? (n.w = +r[0],
        e + r[0].length) : -1
    }
    function Mo(n, t, e) {
        ul.lastIndex = 0;
        var r = ul.exec(t.substring(e));
        return r ? (n.U = +r[0],
        e + r[0].length) : -1
    }
    function _o(n, t, e) {
        ul.lastIndex = 0;
        var r = ul.exec(t.substring(e));
        return r ? (n.W = +r[0],
        e + r[0].length) : -1
    }
    function bo(n, t, e) {
        Ks.lastIndex = 0;
        var r = Ks.exec(t.substring(e));
        return r ? (n.m = Qs.get(r[0].toLowerCase()),
        e + r[0].length) : -1
    }
    function wo(n, t, e) {
        Js.lastIndex = 0;
        var r = Js.exec(t.substring(e));
        return r ? (n.m = Gs.get(r[0].toLowerCase()),
        e + r[0].length) : -1
    }
    function So(n, t, e) {
        return ho(n, el.c.toString(), t, e)
    }
    function ko(n, t, e) {
        return ho(n, el.x.toString(), t, e)
    }
    function Eo(n, t, e) {
        return ho(n, el.X.toString(), t, e)
    }
    function Ao(n, t, e) {
        ul.lastIndex = 0;
        var r = ul.exec(t.substring(e, e + 4));
        return r ? (n.y = +r[0],
        e + r[0].length) : -1
    }
    function Co(n, t, e) {
        ul.lastIndex = 0;
        var r = ul.exec(t.substring(e, e + 2));
        return r ? (n.y = Lo(+r[0]),
        e + r[0].length) : -1
    }
    function No(n, t, e) {
        return /^[+-]\d{4}$/.test(t = t.substring(e, e + 5)) ? (n.Z = +t,
        e + 5) : -1
    }
    function Lo(n) {
        return n + (n > 68 ? 1900 : 2e3)
    }
    function To(n, t, e) {
        ul.lastIndex = 0;
        var r = ul.exec(t.substring(e, e + 2));
        return r ? (n.m = r[0] - 1,
        e + r[0].length) : -1
    }
    function qo(n, t, e) {
        ul.lastIndex = 0;
        var r = ul.exec(t.substring(e, e + 2));
        return r ? (n.d = +r[0],
        e + r[0].length) : -1
    }
    function zo(n, t, e) {
        ul.lastIndex = 0;
        var r = ul.exec(t.substring(e, e + 3));
        return r ? (n.j = +r[0],
        e + r[0].length) : -1
    }
    function Ro(n, t, e) {
        ul.lastIndex = 0;
        var r = ul.exec(t.substring(e, e + 2));
        return r ? (n.H = +r[0],
        e + r[0].length) : -1
    }
    function Do(n, t, e) {
        ul.lastIndex = 0;
        var r = ul.exec(t.substring(e, e + 2));
        return r ? (n.M = +r[0],
        e + r[0].length) : -1
    }
    function Po(n, t, e) {
        ul.lastIndex = 0;
        var r = ul.exec(t.substring(e, e + 2));
        return r ? (n.S = +r[0],
        e + r[0].length) : -1
    }
    function Uo(n, t, e) {
        ul.lastIndex = 0;
        var r = ul.exec(t.substring(e, e + 3));
        return r ? (n.L = +r[0],
        e + r[0].length) : -1
    }
    function jo(n, t, e) {
        var r = il.get(t.substring(e, e += 2).toLowerCase());
        return null == r ? -1 : (n.p = r,
        e)
    }
    function Ho(n) {
        var t = n.getTimezoneOffset()
          , e = t > 0 ? "-" : "+"
          , r = ~~(ca(t) / 60)
          , u = ca(t) % 60;
        return e + vo(r, "0", 2) + vo(u, "0", 2)
    }
    function Fo(n, t, e) {
        nl.lastIndex = 0;
        var r = nl.exec(t.substring(e, e + 1));
        return r ? e + r[0].length : -1
    }
    function Oo(n) {
        function t(n) {
            try {
                Ps = co;
                var t = new Ps;
                return t._ = n,
                e(t)
            } finally {
                Ps = Date
            }
        }
        var e = fo(n);
        return t.parse = function(n) {
            try {
                Ps = co;
                var t = e.parse(n);
                return t && t._
            } finally {
                Ps = Date
            }
        }
        ,
        t.toString = e.toString,
        t
    }
    function Yo(n) {
        return n.toISOString()
    }
    function Io(n, t, e) {
        function r(t) {
            return n(t)
        }
        function u(n, e) {
            var r = n[1] - n[0]
              , u = r / e
              , i = Bo.bisect(al, u);
            return i == al.length ? [t.year, li(n.map(function(n) {
                return n / 31536e6
            }), e)[2]] : i ? t[u / al[i - 1] < al[i] / u ? i - 1 : i] : [fl, li(n, e)[2]]
        }
        return r.invert = function(t) {
            return Zo(n.invert(t))
        }
        ,
        r.domain = function(t) {
            return arguments.length ? (n.domain(t),
            r) : n.domain().map(Zo)
        }
        ,
        r.nice = function(n, t) {
            function e(e) {
                return !isNaN(e) && !n.range(e, Zo(+e + 1), t).length
            }
            var i = r.domain()
              , o = ti(i)
              , a = null == n ? u(o, 10) : "number" == typeof n && u(o, n);
            return a && (n = a[0],
            t = a[1]),
            r.domain(ui(i, t > 1 ? {
                floor: function(t) {
                    for (; e(t = n.floor(t)); )
                        t = Zo(t - 1);
                    return t
                },
                ceil: function(t) {
                    for (; e(t = n.ceil(t)); )
                        t = Zo(+t + 1);
                    return t
                }
            } : n))
        }
        ,
        r.ticks = function(n, t) {
            var e = ti(r.domain())
              , i = null == n ? u(e, 10) : "number" == typeof n ? u(e, n) : !n.range && [{
                range: n
            }, t];
            return i && (n = i[0],
            t = i[1]),
            n.range(e[0], Zo(+e[1] + 1), 1 > t ? 1 : t)
        }
        ,
        r.tickFormat = function() {
            return e
        }
        ,
        r.copy = function() {
            return Io(n.copy(), t, e)
        }
        ,
        ci(r, n)
    }
    function Zo(n) {
        return new Date(n)
    }
    function Vo(n) {
        return function(t) {
            for (var e = n.length - 1, r = n[e]; !r[1](t); )
                r = n[--e];
            return r[0](t)
        }
    }
    function Xo(n) {
        return JSON.parse(n.responseText)
    }
    function $o(n) {
        var t = Go.createRange();
        return t.selectNode(Go.body),
        t.createContextualFragment(n.responseText)
    }
    var Bo = {
        version: "3.3.13"
    };
    Date.now || (Date.now = function() {
        return +new Date
    }
    );
    var Wo = [].slice
      , Jo = function(n) {
        return Wo.call(n)
    }
      , Go = document
      , Ko = Go.documentElement
      , Qo = window;
    try {
        Jo(Ko.childNodes)[0].nodeType
    } catch (na) {
        Jo = function(n) {
            for (var t = n.length, e = new Array(t); t--; )
                e[t] = n[t];
            return e
        }
    }
    try {
        Go.createElement("div").style.setProperty("opacity", 0, "")
    } catch (ta) {
        var ea = Qo.Element.prototype
          , ra = ea.setAttribute
          , ua = ea.setAttributeNS
          , ia = Qo.CSSStyleDeclaration.prototype
          , oa = ia.setProperty;
        ea.setAttribute = function(n, t) {
            ra.call(this, n, t + "")
        }
        ,
        ea.setAttributeNS = function(n, t, e) {
            ua.call(this, n, t, e + "")
        }
        ,
        ia.setProperty = function(n, t, e) {
            oa.call(this, n, t + "", e)
        }
    }
    Bo.ascending = function(n, t) {
        return t > n ? -1 : n > t ? 1 : n >= t ? 0 : 0 / 0
    }
    ,
    Bo.descending = function(n, t) {
        return n > t ? -1 : t > n ? 1 : t >= n ? 0 : 0 / 0
    }
    ,
    Bo.min = function(n, t) {
        var e, r, u = -1, i = n.length;
        if (1 === arguments.length) {
            for (; ++u < i && !(null != (e = n[u]) && e >= e); )
                e = void 0;
            for (; ++u < i; )
                null != (r = n[u]) && e > r && (e = r)
        } else {
            for (; ++u < i && !(null != (e = t.call(n, n[u], u)) && e >= e); )
                e = void 0;
            for (; ++u < i; )
                null != (r = t.call(n, n[u], u)) && e > r && (e = r)
        }
        return e
    }
    ,
    Bo.max = function(n, t) {
        var e, r, u = -1, i = n.length;
        if (1 === arguments.length) {
            for (; ++u < i && !(null != (e = n[u]) && e >= e); )
                e = void 0;
            for (; ++u < i; )
                null != (r = n[u]) && r > e && (e = r)
        } else {
            for (; ++u < i && !(null != (e = t.call(n, n[u], u)) && e >= e); )
                e = void 0;
            for (; ++u < i; )
                null != (r = t.call(n, n[u], u)) && r > e && (e = r)
        }
        return e
    }
    ,
    Bo.extent = function(n, t) {
        var e, r, u, i = -1, o = n.length;
        if (1 === arguments.length) {
            for (; ++i < o && !(null != (e = u = n[i]) && e >= e); )
                e = u = void 0;
            for (; ++i < o; )
                null != (r = n[i]) && (e > r && (e = r),
                r > u && (u = r))
        } else {
            for (; ++i < o && !(null != (e = u = t.call(n, n[i], i)) && e >= e); )
                e = void 0;
            for (; ++i < o; )
                null != (r = t.call(n, n[i], i)) && (e > r && (e = r),
                r > u && (u = r))
        }
        return [e, u]
    }
    ,
    Bo.sum = function(n, t) {
        var e, r = 0, u = n.length, i = -1;
        if (1 === arguments.length)
            for (; ++i < u; )
                isNaN(e = +n[i]) || (r += e);
        else
            for (; ++i < u; )
                isNaN(e = +t.call(n, n[i], i)) || (r += e);
        return r
    }
    ,
    Bo.mean = function(t, e) {
        var r, u = t.length, i = 0, o = -1, a = 0;
        if (1 === arguments.length)
            for (; ++o < u; )
                n(r = t[o]) && (i += (r - i) / ++a);
        else
            for (; ++o < u; )
                n(r = e.call(t, t[o], o)) && (i += (r - i) / ++a);
        return a ? i : void 0
    }
    ,
    Bo.quantile = function(n, t) {
        var e = (n.length - 1) * t + 1
          , r = Math.floor(e)
          , u = +n[r - 1]
          , i = e - r;
        return i ? u + i * (n[r] - u) : u
    }
    ,
    Bo.median = function(t, e) {
        return arguments.length > 1 && (t = t.map(e)),
        t = t.filter(n),
        t.length ? Bo.quantile(t.sort(Bo.ascending), .5) : void 0
    }
    ,
    Bo.bisector = function(n) {
        return {
            left: function(t, e, r, u) {
                for (arguments.length < 3 && (r = 0),
                arguments.length < 4 && (u = t.length); u > r; ) {
                    var i = r + u >>> 1;
                    n.call(t, t[i], i) < e ? r = i + 1 : u = i
                }
                return r
            },
            right: function(t, e, r, u) {
                for (arguments.length < 3 && (r = 0),
                arguments.length < 4 && (u = t.length); u > r; ) {
                    var i = r + u >>> 1;
                    e < n.call(t, t[i], i) ? u = i : r = i + 1
                }
                return r
            }
        }
    }
    ;
    var aa = Bo.bisector(function(n) {
        return n
    });
    Bo.bisectLeft = aa.left,
    Bo.bisect = Bo.bisectRight = aa.right,
    Bo.shuffle = function(n) {
        for (var t, e, r = n.length; r; )
            e = 0 | Math.random() * r--,
            t = n[r],
            n[r] = n[e],
            n[e] = t;
        return n
    }
    ,
    Bo.permute = function(n, t) {
        for (var e = t.length, r = new Array(e); e--; )
            r[e] = n[t[e]];
        return r
    }
    ,
    Bo.pairs = function(n) {
        for (var t, e = 0, r = n.length - 1, u = n[0], i = new Array(0 > r ? 0 : r); r > e; )
            i[e] = [t = u, u = n[++e]];
        return i
    }
    ,
    Bo.zip = function() {
        if (!(u = arguments.length))
            return [];
        for (var n = -1, e = Bo.min(arguments, t), r = new Array(e); ++n < e; )
            for (var u, i = -1, o = r[n] = new Array(u); ++i < u; )
                o[i] = arguments[i][n];
        return r
    }
    ,
    Bo.transpose = function(n) {
        return Bo.zip.apply(Bo, n)
    }
    ,
    Bo.keys = function(n) {
        var t = [];
        for (var e in n)
            t.push(e);
        return t
    }
    ,
    Bo.values = function(n) {
        var t = [];
        for (var e in n)
            t.push(n[e]);
        return t
    }
    ,
    Bo.entries = function(n) {
        var t = [];
        for (var e in n)
            t.push({
                key: e,
                value: n[e]
            });
        return t
    }
    ,
    Bo.merge = function(n) {
        for (var t, e, r, u = n.length, i = -1, o = 0; ++i < u; )
            o += n[i].length;
        for (e = new Array(o); --u >= 0; )
            for (r = n[u],
            t = r.length; --t >= 0; )
                e[--o] = r[t];
        return e
    }
    ;
    var ca = Math.abs;
    Bo.range = function(n, t, r) {
        if (arguments.length < 3 && (r = 1,
        arguments.length < 2 && (t = n,
        n = 0)),
        1 / 0 === (t - n) / r)
            throw new Error("infinite range");
        var u, i = [], o = e(ca(r)), a = -1;
        if (n *= o,
        t *= o,
        r *= o,
        0 > r)
            for (; (u = n + r * ++a) > t; )
                i.push(u / o);
        else
            for (; (u = n + r * ++a) < t; )
                i.push(u / o);
        return i
    }
    ,
    Bo.map = function(n) {
        var t = new u;
        if (n instanceof u)
            n.forEach(function(n, e) {
                t.set(n, e)
            });
        else
            for (var e in n)
                t.set(e, n[e]);
        return t
    }
    ,
    r(u, {
        has: function(n) {
            return sa + n in this
        },
        get: function(n) {
            return this[sa + n]
        },
        set: function(n, t) {
            return this[sa + n] = t
        },
        remove: function(n) {
            return n = sa + n,
            n in this && delete this[n]
        },
        keys: function() {
            var n = [];
            return this.forEach(function(t) {
                n.push(t)
            }),
            n
        },
        values: function() {
            var n = [];
            return this.forEach(function(t, e) {
                n.push(e)
            }),
            n
        },
        entries: function() {
            var n = [];
            return this.forEach(function(t, e) {
                n.push({
                    key: t,
                    value: e
                })
            }),
            n
        },
        forEach: function(n) {
            for (var t in this)
                t.charCodeAt(0) === la && n.call(this, t.substring(1), this[t])
        }
    });
    var sa = "\x00"
      , la = sa.charCodeAt(0);
    Bo.nest = function() {
        function n(t, a, c) {
            if (c >= o.length)
                return r ? r.call(i, a) : e ? a.sort(e) : a;
            for (var s, l, f, h, g = -1, p = a.length, v = o[c++], d = new u; ++g < p; )
                (h = d.get(s = v(l = a[g]))) ? h.push(l) : d.set(s, [l]);
            return t ? (l = t(),
            f = function(e, r) {
                l.set(e, n(t, r, c))
            }
            ) : (l = {},
            f = function(e, r) {
                l[e] = n(t, r, c)
            }
            ),
            d.forEach(f),
            l
        }
        function t(n, e) {
            if (e >= o.length)
                return n;
            var r = []
              , u = a[e++];
            return n.forEach(function(n, u) {
                r.push({
                    key: n,
                    values: t(u, e)
                })
            }),
            u ? r.sort(function(n, t) {
                return u(n.key, t.key)
            }) : r
        }
        var e, r, i = {}, o = [], a = [];
        return i.map = function(t, e) {
            return n(e, t, 0)
        }
        ,
        i.entries = function(e) {
            return t(n(Bo.map, e, 0), 0)
        }
        ,
        i.key = function(n) {
            return o.push(n),
            i
        }
        ,
        i.sortKeys = function(n) {
            return a[o.length - 1] = n,
            i
        }
        ,
        i.sortValues = function(n) {
            return e = n,
            i
        }
        ,
        i.rollup = function(n) {
            return r = n,
            i
        }
        ,
        i
    }
    ,
    Bo.set = function(n) {
        var t = new i;
        if (n)
            for (var e = 0, r = n.length; r > e; ++e)
                t.add(n[e]);
        return t
    }
    ,
    r(i, {
        has: function(n) {
            return sa + n in this
        },
        add: function(n) {
            return this[sa + n] = !0,
            n
        },
        remove: function(n) {
            return n = sa + n,
            n in this && delete this[n]
        },
        values: function() {
            var n = [];
            return this.forEach(function(t) {
                n.push(t)
            }),
            n
        },
        forEach: function(n) {
            for (var t in this)
                t.charCodeAt(0) === la && n.call(this, t.substring(1))
        }
    }),
    Bo.behavior = {},
    Bo.rebind = function(n, t) {
        for (var e, r = 1, u = arguments.length; ++r < u; )
            n[e = arguments[r]] = o(n, t, t[e]);
        return n
    }
    ;
    var fa = ["webkit", "ms", "moz", "Moz", "o", "O"];
    Bo.dispatch = function() {
        for (var n = new s, t = -1, e = arguments.length; ++t < e; )
            n[arguments[t]] = l(n);
        return n
    }
    ,
    s.prototype.on = function(n, t) {
        var e = n.indexOf(".")
          , r = "";
        if (e >= 0 && (r = n.substring(e + 1),
        n = n.substring(0, e)),
        n)
            return arguments.length < 2 ? this[n].on(r) : this[n].on(r, t);
        if (2 === arguments.length) {
            if (null == t)
                for (n in this)
                    this.hasOwnProperty(n) && this[n].on(r, null);
            return this
        }
    }
    ,
    Bo.event = null,
    Bo.requote = function(n) {
        return n.replace(ha, "\\$&")
    }
    ;
    var ha = /[\\\^\$\*\+\?\|\[\]\(\)\.\{\}]/g
      , ga = {}.__proto__ ? function(n, t) {
        n.__proto__ = t
    }
    : function(n, t) {
        for (var e in t)
            n[e] = t[e]
    }
      , pa = function(n, t) {
        return t.querySelector(n)
    }
      , va = function(n, t) {
        return t.querySelectorAll(n)
    }
      , da = Ko[a(Ko, "matchesSelector")]
      , ma = function(n, t) {
        return da.call(n, t)
    };
    "function" == typeof Sizzle && (pa = function(n, t) {
        return Sizzle(n, t)[0] || null
    }
    ,
    va = function(n, t) {
        return Sizzle.uniqueSort(Sizzle(n, t))
    }
    ,
    ma = Sizzle.matchesSelector),
    Bo.selection = function() {
        return _a
    }
    ;
    var ya = Bo.selection.prototype = [];
    ya.select = function(n) {
        var t, e, r, u, i = [];
        n = v(n);
        for (var o = -1, a = this.length; ++o < a; ) {
            i.push(t = []),
            t.parentNode = (r = this[o]).parentNode;
            for (var c = -1, s = r.length; ++c < s; )
                (u = r[c]) ? (t.push(e = n.call(u, u.__data__, c, o)),
                e && "__data__"in u && (e.__data__ = u.__data__)) : t.push(null)
        }
        return p(i)
    }
    ,
    ya.selectAll = function(n) {
        var t, e, r = [];
        n = d(n);
        for (var u = -1, i = this.length; ++u < i; )
            for (var o = this[u], a = -1, c = o.length; ++a < c; )
                (e = o[a]) && (r.push(t = Jo(n.call(e, e.__data__, a, u))),
                t.parentNode = e);
        return p(r)
    }
    ;
    var xa = {
        svg: "http://www.w3.org/2000/svg",
        xhtml: "http://www.w3.org/1999/xhtml",
        xlink: "http://www.w3.org/1999/xlink",
        xml: "http://www.w3.org/XML/1998/namespace",
        xmlns: "http://www.w3.org/2000/xmlns/"
    };
    Bo.ns = {
        prefix: xa,
        qualify: function(n) {
            var t = n.indexOf(":")
              , e = n;
            return t >= 0 && (e = n.substring(0, t),
            n = n.substring(t + 1)),
            xa.hasOwnProperty(e) ? {
                space: xa[e],
                local: n
            } : n
        }
    },
    ya.attr = function(n, t) {
        if (arguments.length < 2) {
            if ("string" == typeof n) {
                var e = this.node();
                return n = Bo.ns.qualify(n),
                n.local ? e.getAttributeNS(n.space, n.local) : e.getAttribute(n)
            }
            for (t in n)
                this.each(m(t, n[t]));
            return this
        }
        return this.each(m(n, t))
    }
    ,
    ya.classed = function(n, t) {
        if (arguments.length < 2) {
            if ("string" == typeof n) {
                var e = this.node()
                  , r = (n = M(n)).length
                  , u = -1;
                if (t = e.classList) {
                    for (; ++u < r; )
                        if (!t.contains(n[u]))
                            return !1
                } else
                    for (t = e.getAttribute("class"); ++u < r; )
                        if (!x(n[u]).test(t))
                            return !1;
                return !0
            }
            for (t in n)
                this.each(_(t, n[t]));
            return this
        }
        return this.each(_(n, t))
    }
    ,
    ya.style = function(n, t, e) {
        var r = arguments.length;
        if (3 > r) {
            if ("string" != typeof n) {
                2 > r && (t = "");
                for (e in n)
                    this.each(w(e, n[e], t));
                return this
            }
            if (2 > r)
                return Qo.getComputedStyle(this.node(), null).getPropertyValue(n);
            e = ""
        }
        return this.each(w(n, t, e))
    }
    ,
    ya.property = function(n, t) {
        if (arguments.length < 2) {
            if ("string" == typeof n)
                return this.node()[n];
            for (t in n)
                this.each(S(t, n[t]));
            return this
        }
        return this.each(S(n, t))
    }
    ,
    ya.text = function(n) {
        return arguments.length ? this.each("function" == typeof n ? function() {
            var t = n.apply(this, arguments);
            this.textContent = null == t ? "" : t
        }
        : null == n ? function() {
            this.textContent = ""
        }
        : function() {
            this.textContent = n
        }
        ) : this.node().textContent
    }
    ,
    ya.html = function(n) {
        return arguments.length ? this.each("function" == typeof n ? function() {
            var t = n.apply(this, arguments);
            this.innerHTML = null == t ? "" : t
        }
        : null == n ? function() {
            this.innerHTML = ""
        }
        : function() {
            this.innerHTML = n
        }
        ) : this.node().innerHTML
    }
    ,
    ya.append = function(n) {
        return n = k(n),
        this.select(function() {
            return this.appendChild(n.apply(this, arguments))
        })
    }
    ,
    ya.insert = function(n, t) {
        return n = k(n),
        t = v(t),
        this.select(function() {
            return this.insertBefore(n.apply(this, arguments), t.apply(this, arguments) || null)
        })
    }
    ,
    ya.remove = function() {
        return this.each(function() {
            var n = this.parentNode;
            n && n.removeChild(this)
        })
    }
    ,
    ya.data = function(n, t) {
        function e(n, e) {
            var r, i, o, a = n.length, f = e.length, h = Math.min(a, f), g = new Array(f), p = new Array(f), v = new Array(a);
            if (t) {
                var d, m = new u, y = new u, x = [];
                for (r = -1; ++r < a; )
                    d = t.call(i = n[r], i.__data__, r),
                    m.has(d) ? v[r] = i : m.set(d, i),
                    x.push(d);
                for (r = -1; ++r < f; )
                    d = t.call(e, o = e[r], r),
                    (i = m.get(d)) ? (g[r] = i,
                    i.__data__ = o) : y.has(d) || (p[r] = E(o)),
                    y.set(d, o),
                    m.remove(d);
                for (r = -1; ++r < a; )
                    m.has(x[r]) && (v[r] = n[r])
            } else {
                for (r = -1; ++r < h; )
                    i = n[r],
                    o = e[r],
                    i ? (i.__data__ = o,
                    g[r] = i) : p[r] = E(o);
                for (; f > r; ++r)
                    p[r] = E(e[r]);
                for (; a > r; ++r)
                    v[r] = n[r]
            }
            p.update = g,
            p.parentNode = g.parentNode = v.parentNode = n.parentNode,
            c.push(p),
            s.push(g),
            l.push(v)
        }
        var r, i, o = -1, a = this.length;
        if (!arguments.length) {
            for (n = new Array(a = (r = this[0]).length); ++o < a; )
                (i = r[o]) && (n[o] = i.__data__);
            return n
        }
        var c = L([])
          , s = p([])
          , l = p([]);
        if ("function" == typeof n)
            for (; ++o < a; )
                e(r = this[o], n.call(r, r.parentNode.__data__, o));
        else
            for (; ++o < a; )
                e(r = this[o], n);
        return s.enter = function() {
            return c
        }
        ,
        s.exit = function() {
            return l
        }
        ,
        s
    }
    ,
    ya.datum = function(n) {
        return arguments.length ? this.property("__data__", n) : this.property("__data__")
    }
    ,
    ya.filter = function(n) {
        var t, e, r, u = [];
        "function" != typeof n && (n = A(n));
        for (var i = 0, o = this.length; o > i; i++) {
            u.push(t = []),
            t.parentNode = (e = this[i]).parentNode;
            for (var a = 0, c = e.length; c > a; a++)
                (r = e[a]) && n.call(r, r.__data__, a, i) && t.push(r)
        }
        return p(u)
    }
    ,
    ya.order = function() {
        for (var n = -1, t = this.length; ++n < t; )
            for (var e, r = this[n], u = r.length - 1, i = r[u]; --u >= 0; )
                (e = r[u]) && (i && i !== e.nextSibling && i.parentNode.insertBefore(e, i),
                i = e);
        return this
    }
    ,
    ya.sort = function(n) {
        n = C.apply(this, arguments);
        for (var t = -1, e = this.length; ++t < e; )
            this[t].sort(n);
        return this.order()
    }
    ,
    ya.each = function(n) {
        return N(this, function(t, e, r) {
            n.call(t, t.__data__, e, r)
        })
    }
    ,
    ya.call = function(n) {
        var t = Jo(arguments);
        return n.apply(t[0] = this, t),
        this
    }
    ,
    ya.empty = function() {
        return !this.node()
    }
    ,
    ya.node = function() {
        for (var n = 0, t = this.length; t > n; n++)
            for (var e = this[n], r = 0, u = e.length; u > r; r++) {
                var i = e[r];
                if (i)
                    return i
            }
        return null
    }
    ,
    ya.size = function() {
        var n = 0;
        return this.each(function() {
            ++n
        }),
        n
    }
    ;
    var Ma = [];
    Bo.selection.enter = L,
    Bo.selection.enter.prototype = Ma,
    Ma.append = ya.append,
    Ma.empty = ya.empty,
    Ma.node = ya.node,
    Ma.call = ya.call,
    Ma.size = ya.size,
    Ma.select = function(n) {
        for (var t, e, r, u, i, o = [], a = -1, c = this.length; ++a < c; ) {
            r = (u = this[a]).update,
            o.push(t = []),
            t.parentNode = u.parentNode;
            for (var s = -1, l = u.length; ++s < l; )
                (i = u[s]) ? (t.push(r[s] = e = n.call(u.parentNode, i.__data__, s, a)),
                e.__data__ = i.__data__) : t.push(null)
        }
        return p(o)
    }
    ,
    Ma.insert = function(n, t) {
        return arguments.length < 2 && (t = T(this)),
        ya.insert.call(this, n, t)
    }
    ,
    ya.transition = function() {
        for (var n, t, e = ks || ++Ls, r = [], u = Es || {
            time: Date.now(),
            ease: Fr,
            delay: 0,
            duration: 250
        }, i = -1, o = this.length; ++i < o; ) {
            r.push(n = []);
            for (var a = this[i], c = -1, s = a.length; ++c < s; )
                (t = a[c]) && io(t, c, e, u),
                n.push(t)
        }
        return eo(r, e)
    }
    ,
    ya.interrupt = function() {
        return this.each(q)
    }
    ,
    Bo.select = function(n) {
        var t = ["string" == typeof n ? pa(n, Go) : n];
        return t.parentNode = Ko,
        p([t])
    }
    ,
    Bo.selectAll = function(n) {
        var t = Jo("string" == typeof n ? va(n, Go) : n);
        return t.parentNode = Ko,
        p([t])
    }
    ;
    var _a = Bo.select(Ko);
    ya.on = function(n, t, e) {
        var r = arguments.length;
        if (3 > r) {
            if ("string" != typeof n) {
                2 > r && (t = !1);
                for (e in n)
                    this.each(z(e, n[e], t));
                return this
            }
            if (2 > r)
                return (r = this.node()["__on" + n]) && r._;
            e = !1
        }
        return this.each(z(n, t, e))
    }
    ;
    var ba = Bo.map({
        mouseenter: "mouseover",
        mouseleave: "mouseout"
    });
    ba.forEach(function(n) {
        "on" + n in Go && ba.remove(n)
    });
    var wa = "onselectstart"in Go ? null : a(Ko.style, "userSelect")
      , Sa = 0;
    Bo.mouse = function(n) {
        return U(n, h())
    }
    ;
    var ka = /WebKit/.test(Qo.navigator.userAgent) ? -1 : 0;
    Bo.touches = function(n, t) {
        return arguments.length < 2 && (t = h().touches),
        t ? Jo(t).map(function(t) {
            var e = U(n, t);
            return e.identifier = t.identifier,
            e
        }) : []
    }
    ,
    Bo.behavior.drag = function() {
        function n() {
            this.on("mousedown.drag", o).on("touchstart.drag", a)
        }
        function t() {
            return Bo.event.changedTouches[0].identifier
        }
        function e(n, t) {
            return Bo.touches(n).filter(function(n) {
                return n.identifier === t
            })[0]
        }
        function r(n, t, e, r) {
            return function() {
                function o() {
                    var n = t(l, g)
                      , e = n[0] - v[0]
                      , r = n[1] - v[1];
                    d |= e | r,
                    v = n,
                    f({
                        type: "drag",
                        x: n[0] + c[0],
                        y: n[1] + c[1],
                        dx: e,
                        dy: r
                    })
                }
                function a() {
                    m.on(e + "." + p, null).on(r + "." + p, null),
                    y(d && Bo.event.target === h),
                    f({
                        type: "dragend"
                    })
                }
                var c, s = this, l = s.parentNode, f = u.of(s, arguments), h = Bo.event.target, g = n(), p = null == g ? "drag" : "drag-" + g, v = t(l, g), d = 0, m = Bo.select(Qo).on(e + "." + p, o).on(r + "." + p, a), y = P();
                i ? (c = i.apply(s, arguments),
                c = [c.x - v[0], c.y - v[1]]) : c = [0, 0],
                f({
                    type: "dragstart"
                })
            }
        }
        var u = g(n, "drag", "dragstart", "dragend")
          , i = null
          , o = r(c, Bo.mouse, "mousemove", "mouseup")
          , a = r(t, e, "touchmove", "touchend");
        return n.origin = function(t) {
            return arguments.length ? (i = t,
            n) : i
        }
        ,
        Bo.rebind(n, u, "on")
    }
    ;
    var Ea = Math.PI
      , Aa = 2 * Ea
      , Ca = Ea / 2
      , Na = 1e-6
      , La = Na * Na
      , Ta = Ea / 180
      , qa = 180 / Ea
      , za = Math.SQRT2
      , Ra = 2
      , Da = 4;
    Bo.interpolateZoom = function(n, t) {
        function e(n) {
            var t = n * y;
            if (m) {
                var e = Y(v)
                  , o = i / (Ra * h) * (e * I(za * t + v) - O(v));
                return [r + o * s, u + o * l, i * e / Y(za * t + v)]
            }
            return [r + n * s, u + n * l, i * Math.exp(za * t)]
        }
        var r = n[0]
          , u = n[1]
          , i = n[2]
          , o = t[0]
          , a = t[1]
          , c = t[2]
          , s = o - r
          , l = a - u
          , f = s * s + l * l
          , h = Math.sqrt(f)
          , g = (c * c - i * i + Da * f) / (2 * i * Ra * h)
          , p = (c * c - i * i - Da * f) / (2 * c * Ra * h)
          , v = Math.log(Math.sqrt(g * g + 1) - g)
          , d = Math.log(Math.sqrt(p * p + 1) - p)
          , m = d - v
          , y = (m || Math.log(c / i)) / za;
        return e.duration = 1e3 * y,
        e
    }
    ,
    Bo.behavior.zoom = function() {
        function n(n) {
            n.on(A, s).on(ja + ".zoom", h).on(C, p).on("dblclick.zoom", v).on(L, l)
        }
        function t(n) {
            return [(n[0] - S.x) / S.k, (n[1] - S.y) / S.k]
        }
        function e(n) {
            return [n[0] * S.k + S.x, n[1] * S.k + S.y]
        }
        function r(n) {
            S.k = Math.max(E[0], Math.min(E[1], n))
        }
        function u(n, t) {
            t = e(t),
            S.x += n[0] - t[0],
            S.y += n[1] - t[1]
        }
        function i() {
            _ && _.domain(M.range().map(function(n) {
                return (n - S.x) / S.k
            }).map(M.invert)),
            w && w.domain(b.range().map(function(n) {
                return (n - S.y) / S.k
            }).map(b.invert))
        }
        function o(n) {
            n({
                type: "zoomstart"
            })
        }
        function a(n) {
            i(),
            n({
                type: "zoom",
                scale: S.k,
                translate: [S.x, S.y]
            })
        }
        function c(n) {
            n({
                type: "zoomend"
            })
        }
        function s() {
            function n() {
                l = 1,
                u(Bo.mouse(r), h),
                a(i)
            }
            function e() {
                f.on(C, Qo === r ? p : null).on(N, null),
                g(l && Bo.event.target === s),
                c(i)
            }
            var r = this
              , i = T.of(r, arguments)
              , s = Bo.event.target
              , l = 0
              , f = Bo.select(Qo).on(C, n).on(N, e)
              , h = t(Bo.mouse(r))
              , g = P();
            q.call(r),
            o(i)
        }
        function l() {
            function n() {
                var n = Bo.touches(p);
                return g = S.k,
                n.forEach(function(n) {
                    n.identifier in d && (d[n.identifier] = t(n))
                }),
                n
            }
            function e() {
                for (var t = Bo.event.changedTouches, e = 0, i = t.length; i > e; ++e)
                    d[t[e].identifier] = null;
                var o = n()
                  , c = Date.now();
                if (1 === o.length) {
                    if (500 > c - x) {
                        var s = o[0]
                          , l = d[s.identifier];
                        r(2 * S.k),
                        u(s, l),
                        f(),
                        a(v)
                    }
                    x = c
                } else if (o.length > 1) {
                    var s = o[0]
                      , h = o[1]
                      , g = s[0] - h[0]
                      , p = s[1] - h[1];
                    m = g * g + p * p
                }
            }
            function i() {
                for (var n, t, e, i, o = Bo.touches(p), c = 0, s = o.length; s > c; ++c,
                i = null)
                    if (e = o[c],
                    i = d[e.identifier]) {
                        if (t)
                            break;
                        n = e,
                        t = i
                    }
                if (i) {
                    var l = (l = e[0] - n[0]) * l + (l = e[1] - n[1]) * l
                      , f = m && Math.sqrt(l / m);
                    n = [(n[0] + e[0]) / 2, (n[1] + e[1]) / 2],
                    t = [(t[0] + i[0]) / 2, (t[1] + i[1]) / 2],
                    r(f * g)
                }
                x = null,
                u(n, t),
                a(v)
            }
            function h() {
                if (Bo.event.touches.length) {
                    for (var t = Bo.event.changedTouches, e = 0, r = t.length; r > e; ++e)
                        delete d[t[e].identifier];
                    for (var u in d)
                        return void n()
                }
                b.on(M, null).on(_, null),
                w.on(A, s).on(L, l),
                k(),
                c(v)
            }
            var g, p = this, v = T.of(p, arguments), d = {}, m = 0, y = Bo.event.changedTouches[0].identifier, M = "touchmove.zoom-" + y, _ = "touchend.zoom-" + y, b = Bo.select(Qo).on(M, i).on(_, h), w = Bo.select(p).on(A, null).on(L, e), k = P();
            q.call(p),
            e(),
            o(v)
        }
        function h() {
            var n = T.of(this, arguments);
            y ? clearTimeout(y) : (q.call(this),
            o(n)),
            y = setTimeout(function() {
                y = null,
                c(n)
            }, 50),
            f();
            var e = m || Bo.mouse(this);
            d || (d = t(e)),
            r(Math.pow(2, .002 * Pa()) * S.k),
            u(e, d),
            a(n)
        }
        function p() {
            d = null
        }
        function v() {
            var n = T.of(this, arguments)
              , e = Bo.mouse(this)
              , i = t(e)
              , s = Math.log(S.k) / Math.LN2;
            o(n),
            r(Math.pow(2, Bo.event.shiftKey ? Math.ceil(s) - 1 : Math.floor(s) + 1)),
            u(e, i),
            a(n),
            c(n)
        }
        var d, m, y, x, M, _, b, w, S = {
            x: 0,
            y: 0,
            k: 1
        }, k = [960, 500], E = Ua, A = "mousedown.zoom", C = "mousemove.zoom", N = "mouseup.zoom", L = "touchstart.zoom", T = g(n, "zoomstart", "zoom", "zoomend");
        return n.event = function(n) {
            n.each(function() {
                var n = T.of(this, arguments)
                  , t = S;
                ks ? Bo.select(this).transition().each("start.zoom", function() {
                    S = this.__chart__ || {
                        x: 0,
                        y: 0,
                        k: 1
                    },
                    o(n)
                }).tween("zoom:zoom", function() {
                    var e = k[0]
                      , r = k[1]
                      , u = e / 2
                      , i = r / 2
                      , o = Bo.interpolateZoom([(u - S.x) / S.k, (i - S.y) / S.k, e / S.k], [(u - t.x) / t.k, (i - t.y) / t.k, e / t.k]);
                    return function(t) {
                        var r = o(t)
                          , c = e / r[2];
                        this.__chart__ = S = {
                            x: u - r[0] * c,
                            y: i - r[1] * c,
                            k: c
                        },
                        a(n)
                    }
                }).each("end.zoom", function() {
                    c(n)
                }) : (this.__chart__ = S,
                o(n),
                a(n),
                c(n))
            })
        }
        ,
        n.translate = function(t) {
            return arguments.length ? (S = {
                x: +t[0],
                y: +t[1],
                k: S.k
            },
            i(),
            n) : [S.x, S.y]
        }
        ,
        n.scale = function(t) {
            return arguments.length ? (S = {
                x: S.x,
                y: S.y,
                k: +t
            },
            i(),
            n) : S.k
        }
        ,
        n.scaleExtent = function(t) {
            return arguments.length ? (E = null == t ? Ua : [+t[0], +t[1]],
            n) : E
        }
        ,
        n.center = function(t) {
            return arguments.length ? (m = t && [+t[0], +t[1]],
            n) : m
        }
        ,
        n.size = function(t) {
            return arguments.length ? (k = t && [+t[0], +t[1]],
            n) : k
        }
        ,
        n.x = function(t) {
            return arguments.length ? (_ = t,
            M = t.copy(),
            S = {
                x: 0,
                y: 0,
                k: 1
            },
            n) : _
        }
        ,
        n.y = function(t) {
            return arguments.length ? (w = t,
            b = t.copy(),
            S = {
                x: 0,
                y: 0,
                k: 1
            },
            n) : w
        }
        ,
        Bo.rebind(n, T, "on")
    }
    ;
    var Pa, Ua = [0, 1 / 0], ja = "onwheel"in Go ? (Pa = function() {
        return -Bo.event.deltaY * (Bo.event.deltaMode ? 120 : 1)
    }
    ,
    "wheel") : "onmousewheel"in Go ? (Pa = function() {
        return Bo.event.wheelDelta
    }
    ,
    "mousewheel") : (Pa = function() {
        return -Bo.event.detail
    }
    ,
    "MozMousePixelScroll");
    V.prototype.toString = function() {
        return this.rgb() + ""
    }
    ,
    Bo.hsl = function(n, t, e) {
        return 1 === arguments.length ? n instanceof $ ? X(n.h, n.s, n.l) : lt("" + n, ft, X) : X(+n, +t, +e)
    }
    ;
    var Ha = $.prototype = new V;
    Ha.brighter = function(n) {
        return n = Math.pow(.7, arguments.length ? n : 1),
        X(this.h, this.s, this.l / n)
    }
    ,
    Ha.darker = function(n) {
        return n = Math.pow(.7, arguments.length ? n : 1),
        X(this.h, this.s, n * this.l)
    }
    ,
    Ha.rgb = function() {
        return B(this.h, this.s, this.l)
    }
    ,
    Bo.hcl = function(n, t, e) {
        return 1 === arguments.length ? n instanceof J ? W(n.h, n.c, n.l) : n instanceof Q ? tt(n.l, n.a, n.b) : tt((n = ht((n = Bo.rgb(n)).r, n.g, n.b)).l, n.a, n.b) : W(+n, +t, +e)
    }
    ;
    var Fa = J.prototype = new V;
    Fa.brighter = function(n) {
        return W(this.h, this.c, Math.min(100, this.l + Oa * (arguments.length ? n : 1)))
    }
    ,
    Fa.darker = function(n) {
        return W(this.h, this.c, Math.max(0, this.l - Oa * (arguments.length ? n : 1)))
    }
    ,
    Fa.rgb = function() {
        return G(this.h, this.c, this.l).rgb()
    }
    ,
    Bo.lab = function(n, t, e) {
        return 1 === arguments.length ? n instanceof Q ? K(n.l, n.a, n.b) : n instanceof J ? G(n.l, n.c, n.h) : ht((n = Bo.rgb(n)).r, n.g, n.b) : K(+n, +t, +e)
    }
    ;
    var Oa = 18
      , Ya = .95047
      , Ia = 1
      , Za = 1.08883
      , Va = Q.prototype = new V;
    Va.brighter = function(n) {
        return K(Math.min(100, this.l + Oa * (arguments.length ? n : 1)), this.a, this.b)
    }
    ,
    Va.darker = function(n) {
        return K(Math.max(0, this.l - Oa * (arguments.length ? n : 1)), this.a, this.b)
    }
    ,
    Va.rgb = function() {
        return nt(this.l, this.a, this.b)
    }
    ,
    Bo.rgb = function(n, t, e) {
        return 1 === arguments.length ? n instanceof ct ? at(n.r, n.g, n.b) : lt("" + n, at, B) : at(~~n, ~~t, ~~e)
    }
    ;
    var Xa = ct.prototype = new V;
    Xa.brighter = function(n) {
        n = Math.pow(.7, arguments.length ? n : 1);
        var t = this.r
          , e = this.g
          , r = this.b
          , u = 30;
        return t || e || r ? (t && u > t && (t = u),
        e && u > e && (e = u),
        r && u > r && (r = u),
        at(Math.min(255, ~~(t / n)), Math.min(255, ~~(e / n)), Math.min(255, ~~(r / n)))) : at(u, u, u)
    }
    ,
    Xa.darker = function(n) {
        return n = Math.pow(.7, arguments.length ? n : 1),
        at(~~(n * this.r), ~~(n * this.g), ~~(n * this.b))
    }
    ,
    Xa.hsl = function() {
        return ft(this.r, this.g, this.b)
    }
    ,
    Xa.toString = function() {
        return "#" + st(this.r) + st(this.g) + st(this.b)
    }
    ;
    var $a = Bo.map({
        aliceblue: 15792383,
        antiquewhite: 16444375,
        aqua: 65535,
        aquamarine: 8388564,
        azure: 15794175,
        beige: 16119260,
        bisque: 16770244,
        black: 0,
        blanchedalmond: 16772045,
        blue: 255,
        blueviolet: 9055202,
        brown: 10824234,
        burlywood: 14596231,
        cadetblue: 6266528,
        chartreuse: 8388352,
        chocolate: 13789470,
        coral: 16744272,
        cornflowerblue: 6591981,
        cornsilk: 16775388,
        crimson: 14423100,
        cyan: 65535,
        darkblue: 139,
        darkcyan: 35723,
        darkgoldenrod: 12092939,
        darkgray: 11119017,
        darkgreen: 25600,
        darkgrey: 11119017,
        darkkhaki: 12433259,
        darkmagenta: 9109643,
        darkolivegreen: 5597999,
        darkorange: 16747520,
        darkorchid: 10040012,
        darkred: 9109504,
        darksalmon: 15308410,
        darkseagreen: 9419919,
        darkslateblue: 4734347,
        darkslategray: 3100495,
        darkslategrey: 3100495,
        darkturquoise: 52945,
        darkviolet: 9699539,
        deeppink: 16716947,
        deepskyblue: 49151,
        dimgray: 6908265,
        dimgrey: 6908265,
        dodgerblue: 2003199,
        firebrick: 11674146,
        floralwhite: 16775920,
        forestgreen: 2263842,
        fuchsia: 16711935,
        gainsboro: 14474460,
        ghostwhite: 16316671,
        gold: 16766720,
        goldenrod: 14329120,
        gray: 8421504,
        green: 32768,
        greenyellow: 11403055,
        grey: 8421504,
        honeydew: 15794160,
        hotpink: 16738740,
        indianred: 13458524,
        indigo: 4915330,
        ivory: 16777200,
        khaki: 15787660,
        lavender: 15132410,
        lavenderblush: 16773365,
        lawngreen: 8190976,
        lemonchiffon: 16775885,
        lightblue: 11393254,
        lightcoral: 15761536,
        lightcyan: 14745599,
        lightgoldenrodyellow: 16448210,
        lightgray: 13882323,
        lightgreen: 9498256,
        lightgrey: 13882323,
        lightpink: 16758465,
        lightsalmon: 16752762,
        lightseagreen: 2142890,
        lightskyblue: 8900346,
        lightslategray: 7833753,
        lightslategrey: 7833753,
        lightsteelblue: 11584734,
        lightyellow: 16777184,
        lime: 65280,
        limegreen: 3329330,
        linen: 16445670,
        magenta: 16711935,
        maroon: 8388608,
        mediumaquamarine: 6737322,
        mediumblue: 205,
        mediumorchid: 12211667,
        mediumpurple: 9662683,
        mediumseagreen: 3978097,
        mediumslateblue: 8087790,
        mediumspringgreen: 64154,
        mediumturquoise: 4772300,
        mediumvioletred: 13047173,
        midnightblue: 1644912,
        mintcream: 16121850,
        mistyrose: 16770273,
        moccasin: 16770229,
        navajowhite: 16768685,
        navy: 128,
        oldlace: 16643558,
        olive: 8421376,
        olivedrab: 7048739,
        orange: 16753920,
        orangered: 16729344,
        orchid: 14315734,
        palegoldenrod: 15657130,
        palegreen: 10025880,
        paleturquoise: 11529966,
        palevioletred: 14381203,
        papayawhip: 16773077,
        peachpuff: 16767673,
        peru: 13468991,
        pink: 16761035,
        plum: 14524637,
        powderblue: 11591910,
        purple: 8388736,
        red: 16711680,
        rosybrown: 12357519,
        royalblue: 4286945,
        saddlebrown: 9127187,
        salmon: 16416882,
        sandybrown: 16032864,
        seagreen: 3050327,
        seashell: 16774638,
        sienna: 10506797,
        silver: 12632256,
        skyblue: 8900331,
        slateblue: 6970061,
        slategray: 7372944,
        slategrey: 7372944,
        snow: 16775930,
        springgreen: 65407,
        steelblue: 4620980,
        tan: 13808780,
        teal: 32896,
        thistle: 14204888,
        tomato: 16737095,
        turquoise: 4251856,
        violet: 15631086,
        wheat: 16113331,
        white: 16777215,
        whitesmoke: 16119285,
        yellow: 16776960,
        yellowgreen: 10145074
    });
    $a.forEach(function(n, t) {
        $a.set(n, it(t))
    }),
    Bo.functor = vt,
    Bo.xhr = mt(dt),
    Bo.dsv = function(n, t) {
        function e(n, e, i) {
            arguments.length < 3 && (i = e,
            e = null);
            var o = yt(n, t, null == e ? r : u(e), i);
            return o.row = function(n) {
                return arguments.length ? o.response(null == (e = n) ? r : u(n)) : e
            }
            ,
            o
        }
        function r(n) {
            return e.parse(n.responseText)
        }
        function u(n) {
            return function(t) {
                return e.parse(t.responseText, n)
            }
        }
        function o(t) {
            return t.map(a).join(n)
        }
        function a(n) {
            return c.test(n) ? '"' + n.replace(/\"/g, '""') + '"' : n
        }
        var c = new RegExp('["' + n + "\n]")
          , s = n.charCodeAt(0);
        return e.parse = function(n, t) {
            var r;
            return e.parseRows(n, function(n, e) {
                if (r)
                    return r(n, e - 1);
                var u = new Function("d","return {" + n.map(function(n, t) {
                    return JSON.stringify(n) + ": d[" + t + "]"
                }).join(",") + "}");
                r = t ? function(n, e) {
                    return t(u(n), e)
                }
                : u
            })
        }
        ,
        e.parseRows = function(n, t) {
            function e() {
                if (l >= c)
                    return o;
                if (u)
                    return u = !1,
                    i;
                var t = l;
                if (34 === n.charCodeAt(t)) {
                    for (var e = t; e++ < c; )
                        if (34 === n.charCodeAt(e)) {
                            if (34 !== n.charCodeAt(e + 1))
                                break;
                            ++e
                        }
                    l = e + 2;
                    var r = n.charCodeAt(e + 1);
                    return 13 === r ? (u = !0,
                    10 === n.charCodeAt(e + 2) && ++l) : 10 === r && (u = !0),
                    n.substring(t + 1, e).replace(/""/g, '"')
                }
                for (; c > l; ) {
                    var r = n.charCodeAt(l++)
                      , a = 1;
                    if (10 === r)
                        u = !0;
                    else if (13 === r)
                        u = !0,
                        10 === n.charCodeAt(l) && (++l,
                        ++a);
                    else if (r !== s)
                        continue;
                    return n.substring(t, l - a)
                }
                return n.substring(t)
            }
            for (var r, u, i = {}, o = {}, a = [], c = n.length, l = 0, f = 0; (r = e()) !== o; ) {
                for (var h = []; r !== i && r !== o; )
                    h.push(r),
                    r = e();
                (!t || (h = t(h, f++))) && a.push(h)
            }
            return a
        }
        ,
        e.format = function(t) {
            if (Array.isArray(t[0]))
                return e.formatRows(t);
            var r = new i
              , u = [];
            return t.forEach(function(n) {
                for (var t in n)
                    r.has(t) || u.push(r.add(t))
            }),
            [u.map(a).join(n)].concat(t.map(function(t) {
                return u.map(function(n) {
                    return a(t[n])
                }).join(n)
            })).join("\n")
        }
        ,
        e.formatRows = function(n) {
            return n.map(o).join("\n")
        }
        ,
        e
    }
    ,
    Bo.csv = Bo.dsv(",", "text/csv"),
    Bo.tsv = Bo.dsv("	", "text/tab-separated-values");
    var Ba, Wa, Ja, Ga, Ka, Qa = Qo[a(Qo, "requestAnimationFrame")] || function(n) {
        setTimeout(n, 17)
    }
    ;
    Bo.timer = function(n, t, e) {
        var r = arguments.length;
        2 > r && (t = 0),
        3 > r && (e = Date.now());
        var u = e + t
          , i = {
            c: n,
            t: u,
            f: !1,
            n: null
        };
        Wa ? Wa.n = i : Ba = i,
        Wa = i,
        Ja || (Ga = clearTimeout(Ga),
        Ja = 1,
        Qa(Mt))
    }
    ,
    Bo.timer.flush = function() {
        _t(),
        bt()
    }
    ;
    var nc = "."
      , tc = ","
      , ec = [3, 3]
      , rc = "$"
      , uc = ["y", "z", "a", "f", "p", "n", "\xb5", "m", "", "k", "M", "G", "T", "P", "E", "Z", "Y"].map(wt);
    Bo.formatPrefix = function(n, t) {
        var e = 0;
        return n && (0 > n && (n *= -1),
        t && (n = Bo.round(n, St(n, t))),
        e = 1 + Math.floor(1e-12 + Math.log(n) / Math.LN10),
        e = Math.max(-24, Math.min(24, 3 * Math.floor((0 >= e ? e + 1 : e - 1) / 3)))),
        uc[8 + e / 3]
    }
    ,
    Bo.round = function(n, t) {
        return t ? Math.round(n * (t = Math.pow(10, t))) / t : Math.round(n)
    }
    ,
    Bo.format = function(n) {
        var t = ic.exec(n)
          , e = t[1] || " "
          , r = t[2] || ">"
          , u = t[3] || ""
          , i = t[4] || ""
          , o = t[5]
          , a = +t[6]
          , c = t[7]
          , s = t[8]
          , l = t[9]
          , f = 1
          , h = ""
          , g = !1;
        switch (s && (s = +s.substring(1)),
        (o || "0" === e && "=" === r) && (o = e = "0",
        r = "=",
        c && (a -= Math.floor((a - 1) / 4))),
        l) {
        case "n":
            c = !0,
            l = "g";
            break;
        case "%":
            f = 100,
            h = "%",
            l = "f";
            break;
        case "p":
            f = 100,
            h = "%",
            l = "r";
            break;
        case "b":
        case "o":
        case "x":
        case "X":
            "#" === i && (i = "0" + l.toLowerCase());
        case "c":
        case "d":
            g = !0,
            s = 0;
            break;
        case "s":
            f = -1,
            l = "r"
        }
        "#" === i ? i = "" : "$" === i && (i = rc),
        "r" != l || s || (l = "g"),
        null != s && ("g" == l ? s = Math.max(1, Math.min(21, s)) : ("e" == l || "f" == l) && (s = Math.max(0, Math.min(20, s)))),
        l = oc.get(l) || kt;
        var p = o && c;
        return function(n) {
            if (g && n % 1)
                return "";
            var t = 0 > n || 0 === n && 0 > 1 / n ? (n = -n,
            "-") : u;
            if (0 > f) {
                var v = Bo.formatPrefix(n, s);
                n = v.scale(n),
                h = v.symbol
            } else
                n *= f;
            n = l(n, s);
            var d = n.lastIndexOf(".")
              , m = 0 > d ? n : n.substring(0, d)
              , y = 0 > d ? "" : nc + n.substring(d + 1);
            !o && c && (m = ac(m));
            var x = i.length + m.length + y.length + (p ? 0 : t.length)
              , M = a > x ? new Array(x = a - x + 1).join(e) : "";
            return p && (m = ac(M + m)),
            t += i,
            n = m + y,
            ("<" === r ? t + n + M : ">" === r ? M + t + n : "^" === r ? M.substring(0, x >>= 1) + t + n + M.substring(x) : t + (p ? n : M + n)) + h
        }
    }
    ;
    var ic = /(?:([^{])?([<>=^]))?([+\- ])?([$#])?(0)?(\d+)?(,)?(\.-?\d+)?([a-z%])?/i
      , oc = Bo.map({
        b: function(n) {
            return n.toString(2)
        },
        c: function(n) {
            return String.fromCharCode(n)
        },
        o: function(n) {
            return n.toString(8)
        },
        x: function(n) {
            return n.toString(16)
        },
        X: function(n) {
            return n.toString(16).toUpperCase()
        },
        g: function(n, t) {
            return n.toPrecision(t)
        },
        e: function(n, t) {
            return n.toExponential(t)
        },
        f: function(n, t) {
            return n.toFixed(t)
        },
        r: function(n, t) {
            return (n = Bo.round(n, St(n, t))).toFixed(Math.max(0, Math.min(20, St(n * (1 + 1e-15), t))))
        }
    })
      , ac = dt;
    if (ec) {
        var cc = ec.length;
        ac = function(n) {
            for (var t = n.length, e = [], r = 0, u = ec[0]; t > 0 && u > 0; )
                e.push(n.substring(t -= u, t + u)),
                u = ec[r = (r + 1) % cc];
            return e.reverse().join(tc)
        }
    }
    Bo.geo = {},
    Et.prototype = {
        s: 0,
        t: 0,
        add: function(n) {
            At(n, this.t, sc),
            At(sc.s, this.s, this),
            this.s ? this.t += sc.t : this.s = sc.t
        },
        reset: function() {
            this.s = this.t = 0
        },
        valueOf: function() {
            return this.s
        }
    };
    var sc = new Et;
    Bo.geo.stream = function(n, t) {
        n && lc.hasOwnProperty(n.type) ? lc[n.type](n, t) : Ct(n, t)
    }
    ;
    var lc = {
        Feature: function(n, t) {
            Ct(n.geometry, t)
        },
        FeatureCollection: function(n, t) {
            for (var e = n.features, r = -1, u = e.length; ++r < u; )
                Ct(e[r].geometry, t)
        }
    }
      , fc = {
        Sphere: function(n, t) {
            t.sphere()
        },
        Point: function(n, t) {
            n = n.coordinates,
            t.point(n[0], n[1], n[2])
        },
        MultiPoint: function(n, t) {
            for (var e = n.coordinates, r = -1, u = e.length; ++r < u; )
                n = e[r],
                t.point(n[0], n[1], n[2])
        },
        LineString: function(n, t) {
            Nt(n.coordinates, t, 0)
        },
        MultiLineString: function(n, t) {
            for (var e = n.coordinates, r = -1, u = e.length; ++r < u; )
                Nt(e[r], t, 0)
        },
        Polygon: function(n, t) {
            Lt(n.coordinates, t)
        },
        MultiPolygon: function(n, t) {
            for (var e = n.coordinates, r = -1, u = e.length; ++r < u; )
                Lt(e[r], t)
        },
        GeometryCollection: function(n, t) {
            for (var e = n.geometries, r = -1, u = e.length; ++r < u; )
                Ct(e[r], t)
        }
    };
    Bo.geo.area = function(n) {
        return hc = 0,
        Bo.geo.stream(n, pc),
        hc
    }
    ;
    var hc, gc = new Et, pc = {
        sphere: function() {
            hc += 4 * Ea
        },
        point: c,
        lineStart: c,
        lineEnd: c,
        polygonStart: function() {
            gc.reset(),
            pc.lineStart = Tt
        },
        polygonEnd: function() {
            var n = 2 * gc;
            hc += 0 > n ? 4 * Ea + n : n,
            pc.lineStart = pc.lineEnd = pc.point = c
        }
    };
    Bo.geo.bounds = function() {
        function n(n, t) {
            x.push(M = [l = n, h = n]),
            f > t && (f = t),
            t > g && (g = t)
        }
        function t(t, e) {
            var r = qt([t * Ta, e * Ta]);
            if (m) {
                var u = Rt(m, r)
                  , i = [u[1], -u[0], 0]
                  , o = Rt(i, u);
                Ut(o),
                o = jt(o);
                var c = t - p
                  , s = c > 0 ? 1 : -1
                  , v = o[0] * qa * s
                  , d = ca(c) > 180;
                if (d ^ (v > s * p && s * t > v)) {
                    var y = o[1] * qa;
                    y > g && (g = y)
                } else if (v = (v + 360) % 360 - 180,
                d ^ (v > s * p && s * t > v)) {
                    var y = -o[1] * qa;
                    f > y && (f = y)
                } else
                    f > e && (f = e),
                    e > g && (g = e);
                d ? p > t ? a(l, t) > a(l, h) && (h = t) : a(t, h) > a(l, h) && (l = t) : h >= l ? (l > t && (l = t),
                t > h && (h = t)) : t > p ? a(l, t) > a(l, h) && (h = t) : a(t, h) > a(l, h) && (l = t)
            } else
                n(t, e);
            m = r,
            p = t
        }
        function e() {
            _.point = t
        }
        function r() {
            M[0] = l,
            M[1] = h,
            _.point = n,
            m = null
        }
        function u(n, e) {
            if (m) {
                var r = n - p;
                y += ca(r) > 180 ? r + (r > 0 ? 360 : -360) : r
            } else
                v = n,
                d = e;
            pc.point(n, e),
            t(n, e)
        }
        function i() {
            pc.lineStart()
        }
        function o() {
            u(v, d),
            pc.lineEnd(),
            ca(y) > Na && (l = -(h = 180)),
            M[0] = l,
            M[1] = h,
            m = null
        }
        function a(n, t) {
            return (t -= n) < 0 ? t + 360 : t
        }
        function c(n, t) {
            return n[0] - t[0]
        }
        function s(n, t) {
            return t[0] <= t[1] ? t[0] <= n && n <= t[1] : n < t[0] || t[1] < n
        }
        var l, f, h, g, p, v, d, m, y, x, M, _ = {
            point: n,
            lineStart: e,
            lineEnd: r,
            polygonStart: function() {
                _.point = u,
                _.lineStart = i,
                _.lineEnd = o,
                y = 0,
                pc.polygonStart()
            },
            polygonEnd: function() {
                pc.polygonEnd(),
                _.point = n,
                _.lineStart = e,
                _.lineEnd = r,
                0 > gc ? (l = -(h = 180),
                f = -(g = 90)) : y > Na ? g = 90 : -Na > y && (f = -90),
                M[0] = l,
                M[1] = h
            }
        };
        return function(n) {
            g = h = -(l = f = 1 / 0),
            x = [],
            Bo.geo.stream(n, _);
            var t = x.length;
            if (t) {
                x.sort(c);
                for (var e, r = 1, u = x[0], i = [u]; t > r; ++r)
                    e = x[r],
                    s(e[0], u) || s(e[1], u) ? (a(u[0], e[1]) > a(u[0], u[1]) && (u[1] = e[1]),
                    a(e[0], u[1]) > a(u[0], u[1]) && (u[0] = e[0])) : i.push(u = e);
                for (var o, e, p = -1 / 0, t = i.length - 1, r = 0, u = i[t]; t >= r; u = e,
                ++r)
                    e = i[r],
                    (o = a(u[1], e[0])) > p && (p = o,
                    l = e[0],
                    h = u[1])
            }
            return x = M = null,
            1 / 0 === l || 1 / 0 === f ? [[0 / 0, 0 / 0], [0 / 0, 0 / 0]] : [[l, f], [h, g]]
        }
    }(),
    Bo.geo.centroid = function(n) {
        vc = dc = mc = yc = xc = Mc = _c = bc = wc = Sc = kc = 0,
        Bo.geo.stream(n, Ec);
        var t = wc
          , e = Sc
          , r = kc
          , u = t * t + e * e + r * r;
        return La > u && (t = Mc,
        e = _c,
        r = bc,
        Na > dc && (t = mc,
        e = yc,
        r = xc),
        u = t * t + e * e + r * r,
        La > u) ? [0 / 0, 0 / 0] : [Math.atan2(e, t) * qa, F(r / Math.sqrt(u)) * qa]
    }
    ;
    var vc, dc, mc, yc, xc, Mc, _c, bc, wc, Sc, kc, Ec = {
        sphere: c,
        point: Ft,
        lineStart: Yt,
        lineEnd: It,
        polygonStart: function() {
            Ec.lineStart = Zt
        },
        polygonEnd: function() {
            Ec.lineStart = Yt
        }
    }, Ac = Wt(Vt, ne, ee, [-Ea, -Ea / 2]), Cc = 1e9;
    Bo.geo.clipExtent = function() {
        var n, t, e, r, u, i, o = {
            stream: function(n) {
                return u && (u.valid = !1),
                u = i(n),
                u.valid = !0,
                u
            },
            extent: function(a) {
                return arguments.length ? (i = ie(n = +a[0][0], t = +a[0][1], e = +a[1][0], r = +a[1][1]),
                u && (u.valid = !1,
                u = null),
                o) : [[n, t], [e, r]]
            }
        };
        return o.extent([[0, 0], [960, 500]])
    }
    ,
    (Bo.geo.conicEqualArea = function() {
        return ae(ce)
    }
    ).raw = ce,
    Bo.geo.albers = function() {
        return Bo.geo.conicEqualArea().rotate([96, 0]).center([-.6, 38.7]).parallels([29.5, 45.5]).scale(1070)
    }
    ,
    Bo.geo.albersUsa = function() {
        function n(n) {
            var i = n[0]
              , o = n[1];
            return t = null,
            e(i, o),
            t || (r(i, o),
            t) || u(i, o),
            t
        }
        var t, e, r, u, i = Bo.geo.albers(), o = Bo.geo.conicEqualArea().rotate([154, 0]).center([-2, 58.5]).parallels([55, 65]), a = Bo.geo.conicEqualArea().rotate([157, 0]).center([-3, 19.9]).parallels([8, 18]), c = {
            point: function(n, e) {
                t = [n, e]
            }
        };
        return n.invert = function(n) {
            var t = i.scale()
              , e = i.translate()
              , r = (n[0] - e[0]) / t
              , u = (n[1] - e[1]) / t;
            return (u >= .12 && .234 > u && r >= -.425 && -.214 > r ? o : u >= .166 && .234 > u && r >= -.214 && -.115 > r ? a : i).invert(n)
        }
        ,
        n.stream = function(n) {
            var t = i.stream(n)
              , e = o.stream(n)
              , r = a.stream(n);
            return {
                point: function(n, u) {
                    t.point(n, u),
                    e.point(n, u),
                    r.point(n, u)
                },
                sphere: function() {
                    t.sphere(),
                    e.sphere(),
                    r.sphere()
                },
                lineStart: function() {
                    t.lineStart(),
                    e.lineStart(),
                    r.lineStart()
                },
                lineEnd: function() {
                    t.lineEnd(),
                    e.lineEnd(),
                    r.lineEnd()
                },
                polygonStart: function() {
                    t.polygonStart(),
                    e.polygonStart(),
                    r.polygonStart()
                },
                polygonEnd: function() {
                    t.polygonEnd(),
                    e.polygonEnd(),
                    r.polygonEnd()
                }
            }
        }
        ,
        n.precision = function(t) {
            return arguments.length ? (i.precision(t),
            o.precision(t),
            a.precision(t),
            n) : i.precision()
        }
        ,
        n.scale = function(t) {
            return arguments.length ? (i.scale(t),
            o.scale(.35 * t),
            a.scale(t),
            n.translate(i.translate())) : i.scale()
        }
        ,
        n.translate = function(t) {
            if (!arguments.length)
                return i.translate();
            var s = i.scale()
              , l = +t[0]
              , f = +t[1];
            return e = i.translate(t).clipExtent([[l - .455 * s, f - .238 * s], [l + .455 * s, f + .238 * s]]).stream(c).point,
            r = o.translate([l - .307 * s, f + .201 * s]).clipExtent([[l - .425 * s + Na, f + .12 * s + Na], [l - .214 * s - Na, f + .234 * s - Na]]).stream(c).point,
            u = a.translate([l - .205 * s, f + .212 * s]).clipExtent([[l - .214 * s + Na, f + .166 * s + Na], [l - .115 * s - Na, f + .234 * s - Na]]).stream(c).point,
            n
        }
        ,
        n.scale(1070)
    }
    ;
    var Nc, Lc, Tc, qc, zc, Rc, Dc = {
        point: c,
        lineStart: c,
        lineEnd: c,
        polygonStart: function() {
            Lc = 0,
            Dc.lineStart = se
        },
        polygonEnd: function() {
            Dc.lineStart = Dc.lineEnd = Dc.point = c,
            Nc += ca(Lc / 2)
        }
    }, Pc = {
        point: le,
        lineStart: c,
        lineEnd: c,
        polygonStart: c,
        polygonEnd: c
    }, Uc = {
        point: ge,
        lineStart: pe,
        lineEnd: ve,
        polygonStart: function() {
            Uc.lineStart = de
        },
        polygonEnd: function() {
            Uc.point = ge,
            Uc.lineStart = pe,
            Uc.lineEnd = ve
        }
    };
    Bo.geo.path = function() {
        function n(n) {
            return n && ("function" == typeof a && i.pointRadius(+a.apply(this, arguments)),
            o && o.valid || (o = u(i)),
            Bo.geo.stream(n, o)),
            i.result()
        }
        function t() {
            return o = null,
            n
        }
        var e, r, u, i, o, a = 4.5;
        return n.area = function(n) {
            return Nc = 0,
            Bo.geo.stream(n, u(Dc)),
            Nc
        }
        ,
        n.centroid = function(n) {
            return mc = yc = xc = Mc = _c = bc = wc = Sc = kc = 0,
            Bo.geo.stream(n, u(Uc)),
            kc ? [wc / kc, Sc / kc] : bc ? [Mc / bc, _c / bc] : xc ? [mc / xc, yc / xc] : [0 / 0, 0 / 0]
        }
        ,
        n.bounds = function(n) {
            return zc = Rc = -(Tc = qc = 1 / 0),
            Bo.geo.stream(n, u(Pc)),
            [[Tc, qc], [zc, Rc]]
        }
        ,
        n.projection = function(n) {
            return arguments.length ? (u = (e = n) ? n.stream || xe(n) : dt,
            t()) : e
        }
        ,
        n.context = function(n) {
            return arguments.length ? (i = null == (r = n) ? new fe : new me(n),
            "function" != typeof a && i.pointRadius(a),
            t()) : r
        }
        ,
        n.pointRadius = function(t) {
            return arguments.length ? (a = "function" == typeof t ? t : (i.pointRadius(+t),
            +t),
            n) : a
        }
        ,
        n.projection(Bo.geo.albersUsa()).context(null)
    }
    ,
    Bo.geo.transform = function(n) {
        return {
            stream: function(t) {
                var e = new Me(t);
                for (var r in n)
                    e[r] = n[r];
                return e
            }
        }
    }
    ,
    Me.prototype = {
        point: function(n, t) {
            this.stream.point(n, t)
        },
        sphere: function() {
            this.stream.sphere()
        },
        lineStart: function() {
            this.stream.lineStart()
        },
        lineEnd: function() {
            this.stream.lineEnd()
        },
        polygonStart: function() {
            this.stream.polygonStart()
        },
        polygonEnd: function() {
            this.stream.polygonEnd()
        }
    },
    Bo.geo.projection = be,
    Bo.geo.projectionMutator = we,
    (Bo.geo.equirectangular = function() {
        return be(ke)
    }
    ).raw = ke.invert = ke,
    Bo.geo.rotation = function(n) {
        function t(t) {
            return t = n(t[0] * Ta, t[1] * Ta),
            t[0] *= qa,
            t[1] *= qa,
            t
        }
        return n = Ae(n[0] % 360 * Ta, n[1] * Ta, n.length > 2 ? n[2] * Ta : 0),
        t.invert = function(t) {
            return t = n.invert(t[0] * Ta, t[1] * Ta),
            t[0] *= qa,
            t[1] *= qa,
            t
        }
        ,
        t
    }
    ,
    Ee.invert = ke,
    Bo.geo.circle = function() {
        function n() {
            var n = "function" == typeof r ? r.apply(this, arguments) : r
              , t = Ae(-n[0] * Ta, -n[1] * Ta, 0).invert
              , u = [];
            return e(null, null, 1, {
                point: function(n, e) {
                    u.push(n = t(n, e)),
                    n[0] *= qa,
                    n[1] *= qa
                }
            }),
            {
                type: "Polygon",
                coordinates: [u]
            }
        }
        var t, e, r = [0, 0], u = 6;
        return n.origin = function(t) {
            return arguments.length ? (r = t,
            n) : r
        }
        ,
        n.angle = function(r) {
            return arguments.length ? (e = Te((t = +r) * Ta, u * Ta),
            n) : t
        }
        ,
        n.precision = function(r) {
            return arguments.length ? (e = Te(t * Ta, (u = +r) * Ta),
            n) : u
        }
        ,
        n.angle(90)
    }
    ,
    Bo.geo.distance = function(n, t) {
        var e, r = (t[0] - n[0]) * Ta, u = n[1] * Ta, i = t[1] * Ta, o = Math.sin(r), a = Math.cos(r), c = Math.sin(u), s = Math.cos(u), l = Math.sin(i), f = Math.cos(i);
        return Math.atan2(Math.sqrt((e = f * o) * e + (e = s * l - c * f * a) * e), c * l + s * f * a)
    }
    ,
    Bo.geo.graticule = function() {
        function n() {
            return {
                type: "MultiLineString",
                coordinates: t()
            }
        }
        function t() {
            return Bo.range(Math.ceil(i / d) * d, u, d).map(h).concat(Bo.range(Math.ceil(s / m) * m, c, m).map(g)).concat(Bo.range(Math.ceil(r / p) * p, e, p).filter(function(n) {
                return ca(n % d) > Na
            }).map(l)).concat(Bo.range(Math.ceil(a / v) * v, o, v).filter(function(n) {
                return ca(n % m) > Na
            }).map(f))
        }
        var e, r, u, i, o, a, c, s, l, f, h, g, p = 10, v = p, d = 90, m = 360, y = 2.5;
        return n.lines = function() {
            return t().map(function(n) {
                return {
                    type: "LineString",
                    coordinates: n
                }
            })
        }
        ,
        n.outline = function() {
            return {
                type: "Polygon",
                coordinates: [h(i).concat(g(c).slice(1), h(u).reverse().slice(1), g(s).reverse().slice(1))]
            }
        }
        ,
        n.extent = function(t) {
            return arguments.length ? n.majorExtent(t).minorExtent(t) : n.minorExtent()
        }
        ,
        n.majorExtent = function(t) {
            return arguments.length ? (i = +t[0][0],
            u = +t[1][0],
            s = +t[0][1],
            c = +t[1][1],
            i > u && (t = i,
            i = u,
            u = t),
            s > c && (t = s,
            s = c,
            c = t),
            n.precision(y)) : [[i, s], [u, c]]
        }
        ,
        n.minorExtent = function(t) {
            return arguments.length ? (r = +t[0][0],
            e = +t[1][0],
            a = +t[0][1],
            o = +t[1][1],
            r > e && (t = r,
            r = e,
            e = t),
            a > o && (t = a,
            a = o,
            o = t),
            n.precision(y)) : [[r, a], [e, o]]
        }
        ,
        n.step = function(t) {
            return arguments.length ? n.majorStep(t).minorStep(t) : n.minorStep()
        }
        ,
        n.majorStep = function(t) {
            return arguments.length ? (d = +t[0],
            m = +t[1],
            n) : [d, m]
        }
        ,
        n.minorStep = function(t) {
            return arguments.length ? (p = +t[0],
            v = +t[1],
            n) : [p, v]
        }
        ,
        n.precision = function(t) {
            return arguments.length ? (y = +t,
            l = ze(a, o, 90),
            f = Re(r, e, y),
            h = ze(s, c, 90),
            g = Re(i, u, y),
            n) : y
        }
        ,
        n.majorExtent([[-180, -90 + Na], [180, 90 - Na]]).minorExtent([[-180, -80 - Na], [180, 80 + Na]])
    }
    ,
    Bo.geo.greatArc = function() {
        function n() {
            return {
                type: "LineString",
                coordinates: [t || r.apply(this, arguments), e || u.apply(this, arguments)]
            }
        }
        var t, e, r = De, u = Pe;
        return n.distance = function() {
            return Bo.geo.distance(t || r.apply(this, arguments), e || u.apply(this, arguments))
        }
        ,
        n.source = function(e) {
            return arguments.length ? (r = e,
            t = "function" == typeof e ? null : e,
            n) : r
        }
        ,
        n.target = function(t) {
            return arguments.length ? (u = t,
            e = "function" == typeof t ? null : t,
            n) : u
        }
        ,
        n.precision = function() {
            return arguments.length ? n : 0
        }
        ,
        n
    }
    ,
    Bo.geo.interpolate = function(n, t) {
        return Ue(n[0] * Ta, n[1] * Ta, t[0] * Ta, t[1] * Ta)
    }
    ,
    Bo.geo.length = function(n) {
        return jc = 0,
        Bo.geo.stream(n, Hc),
        jc
    }
    ;
    var jc, Hc = {
        sphere: c,
        point: c,
        lineStart: je,
        lineEnd: c,
        polygonStart: c,
        polygonEnd: c
    }, Fc = He(function(n) {
        return Math.sqrt(2 / (1 + n))
    }, function(n) {
        return 2 * Math.asin(n / 2)
    });
    (Bo.geo.azimuthalEqualArea = function() {
        return be(Fc)
    }
    ).raw = Fc;
    var Oc = He(function(n) {
        var t = Math.acos(n);
        return t && t / Math.sin(t)
    }, dt);
    (Bo.geo.azimuthalEquidistant = function() {
        return be(Oc)
    }
    ).raw = Oc,
    (Bo.geo.conicConformal = function() {
        return ae(Fe)
    }
    ).raw = Fe,
    (Bo.geo.conicEquidistant = function() {
        return ae(Oe)
    }
    ).raw = Oe;
    var Yc = He(function(n) {
        return 1 / n
    }, Math.atan);
    (Bo.geo.gnomonic = function() {
        return be(Yc)
    }
    ).raw = Yc,
    Ye.invert = function(n, t) {
        return [n, 2 * Math.atan(Math.exp(t)) - Ca]
    }
    ,
    (Bo.geo.mercator = function() {
        return Ie(Ye)
    }
    ).raw = Ye;
    var Ic = He(function() {
        return 1
    }, Math.asin);
    (Bo.geo.orthographic = function() {
        return be(Ic)
    }
    ).raw = Ic;
    var Zc = He(function(n) {
        return 1 / (1 + n)
    }, function(n) {
        return 2 * Math.atan(n)
    });
    (Bo.geo.stereographic = function() {
        return be(Zc)
    }
    ).raw = Zc,
    Ze.invert = function(n, t) {
        return [-t, 2 * Math.atan(Math.exp(n)) - Ca]
    }
    ,
    (Bo.geo.transverseMercator = function() {
        var n = Ie(Ze)
          , t = n.center
          , e = n.rotate;
        return n.center = function(n) {
            return n ? t([-n[1], n[0]]) : (n = t(),
            [-n[1], n[0]])
        }
        ,
        n.rotate = function(n) {
            return n ? e([n[0], n[1], n.length > 2 ? n[2] + 90 : 90]) : (n = e(),
            [n[0], n[1], n[2] - 90])
        }
        ,
        n.rotate([0, 0])
    }
    ).raw = Ze,
    Bo.geom = {},
    Bo.geom.hull = function(n) {
        function t(n) {
            if (n.length < 3)
                return [];
            var t, u, i, o, a, c, s, l, f, h, g, p, v = vt(e), d = vt(r), m = n.length, y = m - 1, x = [], M = [], _ = 0;
            if (v === Ve && r === Xe)
                t = n;
            else
                for (i = 0,
                t = []; m > i; ++i)
                    t.push([+v.call(this, u = n[i], i), +d.call(this, u, i)]);
            for (i = 1; m > i; ++i)
                (t[i][1] < t[_][1] || t[i][1] == t[_][1] && t[i][0] < t[_][0]) && (_ = i);
            for (i = 0; m > i; ++i)
                i !== _ && (c = t[i][1] - t[_][1],
                a = t[i][0] - t[_][0],
                x.push({
                    angle: Math.atan2(c, a),
                    index: i
                }));
            for (x.sort(function(n, t) {
                return n.angle - t.angle
            }),
            g = x[0].angle,
            h = x[0].index,
            f = 0,
            i = 1; y > i; ++i) {
                if (o = x[i].index,
                g == x[i].angle) {
                    if (a = t[h][0] - t[_][0],
                    c = t[h][1] - t[_][1],
                    s = t[o][0] - t[_][0],
                    l = t[o][1] - t[_][1],
                    a * a + c * c >= s * s + l * l) {
                        x[i].index = -1;
                        continue
                    }
                    x[f].index = -1
                }
                g = x[i].angle,
                f = i,
                h = o
            }
            for (M.push(_),
            i = 0,
            o = 0; 2 > i; ++o)
                x[o].index > -1 && (M.push(x[o].index),
                i++);
            for (p = M.length; y > o; ++o)
                if (!(x[o].index < 0)) {
                    for (; !$e(M[p - 2], M[p - 1], x[o].index, t); )
                        --p;
                    M[p++] = x[o].index
                }
            var b = [];
            for (i = p - 1; i >= 0; --i)
                b.push(n[M[i]]);
            return b
        }
        var e = Ve
          , r = Xe;
        return arguments.length ? t(n) : (t.x = function(n) {
            return arguments.length ? (e = n,
            t) : e
        }
        ,
        t.y = function(n) {
            return arguments.length ? (r = n,
            t) : r
        }
        ,
        t)
    }
    ,
    Bo.geom.polygon = function(n) {
        return ga(n, Vc),
        n
    }
    ;
    var Vc = Bo.geom.polygon.prototype = [];
    Vc.area = function() {
        for (var n, t = -1, e = this.length, r = this[e - 1], u = 0; ++t < e; )
            n = r,
            r = this[t],
            u += n[1] * r[0] - n[0] * r[1];
        return .5 * u
    }
    ,
    Vc.centroid = function(n) {
        var t, e, r = -1, u = this.length, i = 0, o = 0, a = this[u - 1];
        for (arguments.length || (n = -1 / (6 * this.area())); ++r < u; )
            t = a,
            a = this[r],
            e = t[0] * a[1] - a[0] * t[1],
            i += (t[0] + a[0]) * e,
            o += (t[1] + a[1]) * e;
        return [i * n, o * n]
    }
    ,
    Vc.clip = function(n) {
        for (var t, e, r, u, i, o, a = Je(n), c = -1, s = this.length - Je(this), l = this[s - 1]; ++c < s; ) {
            for (t = n.slice(),
            n.length = 0,
            u = this[c],
            i = t[(r = t.length - a) - 1],
            e = -1; ++e < r; )
                o = t[e],
                Be(o, l, u) ? (Be(i, l, u) || n.push(We(i, o, l, u)),
                n.push(o)) : Be(i, l, u) && n.push(We(i, o, l, u)),
                i = o;
            a && n.push(n[0]),
            l = u
        }
        return n
    }
    ;
    var Xc, $c, Bc, Wc, Jc, Gc = [], Kc = [];
    ur.prototype.prepare = function() {
        for (var n, t = this.edges, e = t.length; e--; )
            n = t[e].edge,
            n.b && n.a || t.splice(e, 1);
        return t.sort(or),
        t.length
    }
    ,
    dr.prototype = {
        start: function() {
            return this.edge.l === this.site ? this.edge.a : this.edge.b
        },
        end: function() {
            return this.edge.l === this.site ? this.edge.b : this.edge.a
        }
    },
    mr.prototype = {
        insert: function(n, t) {
            var e, r, u;
            if (n) {
                if (t.P = n,
                t.N = n.N,
                n.N && (n.N.P = t),
                n.N = t,
                n.R) {
                    for (n = n.R; n.L; )
                        n = n.L;
                    n.L = t
                } else
                    n.R = t;
                e = n
            } else
                this._ ? (n = _r(this._),
                t.P = null,
                t.N = n,
                n.P = n.L = t,
                e = n) : (t.P = t.N = null,
                this._ = t,
                e = null);
            for (t.L = t.R = null,
            t.U = e,
            t.C = !0,
            n = t; e && e.C; )
                r = e.U,
                e === r.L ? (u = r.R,
                u && u.C ? (e.C = u.C = !1,
                r.C = !0,
                n = r) : (n === e.R && (xr(this, e),
                n = e,
                e = n.U),
                e.C = !1,
                r.C = !0,
                Mr(this, r))) : (u = r.L,
                u && u.C ? (e.C = u.C = !1,
                r.C = !0,
                n = r) : (n === e.L && (Mr(this, e),
                n = e,
                e = n.U),
                e.C = !1,
                r.C = !0,
                xr(this, r))),
                e = n.U;
            this._.C = !1
        },
        remove: function(n) {
            n.N && (n.N.P = n.P),
            n.P && (n.P.N = n.N),
            n.N = n.P = null;
            var t, e, r, u = n.U, i = n.L, o = n.R;
            if (e = i ? o ? _r(o) : i : o,
            u ? u.L === n ? u.L = e : u.R = e : this._ = e,
            i && o ? (r = e.C,
            e.C = n.C,
            e.L = i,
            i.U = e,
            e !== o ? (u = e.U,
            e.U = n.U,
            n = e.R,
            u.L = n,
            e.R = o,
            o.U = e) : (e.U = u,
            u = e,
            n = e.R)) : (r = n.C,
            n = e),
            n && (n.U = u),
            !r) {
                if (n && n.C)
                    return n.C = !1,
                    void 0;
                do {
                    if (n === this._)
                        break;
                    if (n === u.L) {
                        if (t = u.R,
                        t.C && (t.C = !1,
                        u.C = !0,
                        xr(this, u),
                        t = u.R),
                        t.L && t.L.C || t.R && t.R.C) {
                            t.R && t.R.C || (t.L.C = !1,
                            t.C = !0,
                            Mr(this, t),
                            t = u.R),
                            t.C = u.C,
                            u.C = t.R.C = !1,
                            xr(this, u),
                            n = this._;
                            break
                        }
                    } else if (t = u.L,
                    t.C && (t.C = !1,
                    u.C = !0,
                    Mr(this, u),
                    t = u.L),
                    t.L && t.L.C || t.R && t.R.C) {
                        t.L && t.L.C || (t.R.C = !1,
                        t.C = !0,
                        xr(this, t),
                        t = u.L),
                        t.C = u.C,
                        u.C = t.L.C = !1,
                        Mr(this, u),
                        n = this._;
                        break
                    }
                    t.C = !0,
                    n = u,
                    u = u.U
                } while (!n.C);
                n && (n.C = !1)
            }
        }
    },
    Bo.geom.voronoi = function(n) {
        function t(n) {
            var t = new Array(n.length)
              , r = a[0][0]
              , u = a[0][1]
              , i = a[1][0]
              , o = a[1][1];
            return br(e(n), a).cells.forEach(function(e, a) {
                var c = e.edges
                  , s = e.site
                  , l = t[a] = c.length ? c.map(function(n) {
                    var t = n.start();
                    return [t.x, t.y]
                }) : s.x >= r && s.x <= i && s.y >= u && s.y <= o ? [[r, o], [i, o], [i, u], [r, u]] : [];
                l.point = n[a]
            }),
            t
        }
        function e(n) {
            return n.map(function(n, t) {
                return {
                    x: Math.round(i(n, t) / Na) * Na,
                    y: Math.round(o(n, t) / Na) * Na,
                    i: t
                }
            })
        }
        var r = Ve
          , u = Xe
          , i = r
          , o = u
          , a = Qc;
        return n ? t(n) : (t.links = function(n) {
            return br(e(n)).edges.filter(function(n) {
                return n.l && n.r
            }).map(function(t) {
                return {
                    source: n[t.l.i],
                    target: n[t.r.i]
                }
            })
        }
        ,
        t.triangles = function(n) {
            var t = [];
            return br(e(n)).cells.forEach(function(e, r) {
                for (var u, i, o = e.site, a = e.edges.sort(or), c = -1, s = a.length, l = a[s - 1].edge, f = l.l === o ? l.r : l.l; ++c < s; )
                    u = l,
                    i = f,
                    l = a[c].edge,
                    f = l.l === o ? l.r : l.l,
                    r < i.i && r < f.i && Sr(o, i, f) < 0 && t.push([n[r], n[i.i], n[f.i]])
            }),
            t
        }
        ,
        t.x = function(n) {
            return arguments.length ? (i = vt(r = n),
            t) : r
        }
        ,
        t.y = function(n) {
            return arguments.length ? (o = vt(u = n),
            t) : u
        }
        ,
        t.clipExtent = function(n) {
            return arguments.length ? (a = null == n ? Qc : n,
            t) : a === Qc ? null : a
        }
        ,
        t.size = function(n) {
            return arguments.length ? t.clipExtent(n && [[0, 0], n]) : a === Qc ? null : a && a[1]
        }
        ,
        t)
    }
    ;
    var Qc = [[-1e6, -1e6], [1e6, 1e6]];
    Bo.geom.delaunay = function(n) {
        return Bo.geom.voronoi().triangles(n)
    }
    ,
    Bo.geom.quadtree = function(n, t, e, r, u) {
        function i(n) {
            function i(n, t, e, r, u, i, o, a) {
                if (!isNaN(e) && !isNaN(r))
                    if (n.leaf) {
                        var c = n.x
                          , l = n.y;
                        if (null != c)
                            if (ca(c - e) + ca(l - r) < .01)
                                s(n, t, e, r, u, i, o, a);
                            else {
                                var f = n.point;
                                n.x = n.y = n.point = null,
                                s(n, f, c, l, u, i, o, a),
                                s(n, t, e, r, u, i, o, a)
                            }
                        else
                            n.x = e,
                            n.y = r,
                            n.point = t
                    } else
                        s(n, t, e, r, u, i, o, a)
            }
            function s(n, t, e, r, u, o, a, c) {
                var s = .5 * (u + a)
                  , l = .5 * (o + c)
                  , f = e >= s
                  , h = r >= l
                  , g = (h << 1) + f;
                n.leaf = !1,
                n = n.nodes[g] || (n.nodes[g] = Ar()),
                f ? u = s : a = s,
                h ? o = l : c = l,
                i(n, t, e, r, u, o, a, c)
            }
            var l, f, h, g, p, v, d, m, y, x = vt(a), M = vt(c);
            if (null != t)
                v = t,
                d = e,
                m = r,
                y = u;
            else if (m = y = -(v = d = 1 / 0),
            f = [],
            h = [],
            p = n.length,
            o)
                for (g = 0; p > g; ++g)
                    l = n[g],
                    l.x < v && (v = l.x),
                    l.y < d && (d = l.y),
                    l.x > m && (m = l.x),
                    l.y > y && (y = l.y),
                    f.push(l.x),
                    h.push(l.y);
            else
                for (g = 0; p > g; ++g) {
                    var _ = +x(l = n[g], g)
                      , b = +M(l, g);
                    v > _ && (v = _),
                    d > b && (d = b),
                    _ > m && (m = _),
                    b > y && (y = b),
                    f.push(_),
                    h.push(b)
                }
            var w = m - v
              , S = y - d;
            w > S ? y = d + w : m = v + S;
            var k = Ar();
            if (k.add = function(n) {
                i(k, n, +x(n, ++g), +M(n, g), v, d, m, y)
            }
            ,
            k.visit = function(n) {
                Cr(n, k, v, d, m, y)
            }
            ,
            g = -1,
            null == t) {
                for (; ++g < p; )
                    i(k, n[g], f[g], h[g], v, d, m, y);
                --g
            } else
                n.forEach(k.add);
            return f = h = n = l = null,
            k
        }
        var o, a = Ve, c = Xe;
        return (o = arguments.length) ? (a = kr,
        c = Er,
        3 === o && (u = e,
        r = t,
        e = t = 0),
        i(n)) : (i.x = function(n) {
            return arguments.length ? (a = n,
            i) : a
        }
        ,
        i.y = function(n) {
            return arguments.length ? (c = n,
            i) : c
        }
        ,
        i.extent = function(n) {
            return arguments.length ? (null == n ? t = e = r = u = null : (t = +n[0][0],
            e = +n[0][1],
            r = +n[1][0],
            u = +n[1][1]),
            i) : null == t ? null : [[t, e], [r, u]]
        }
        ,
        i.size = function(n) {
            return arguments.length ? (null == n ? t = e = r = u = null : (t = e = 0,
            r = +n[0],
            u = +n[1]),
            i) : null == t ? null : [r - t, u - e]
        }
        ,
        i)
    }
    ,
    Bo.interpolateRgb = Nr,
    Bo.interpolateObject = Lr,
    Bo.interpolateNumber = Tr,
    Bo.interpolateString = qr;
    var ns = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g;
    Bo.interpolate = zr,
    Bo.interpolators = [function(n, t) {
        var e = typeof t;
        return ("string" === e ? $a.has(t) || /^(#|rgb\(|hsl\()/.test(t) ? Nr : qr : t instanceof V ? Nr : "object" === e ? Array.isArray(t) ? Rr : Lr : Tr)(n, t)
    }
    ],
    Bo.interpolateArray = Rr;
    var ts = function() {
        return dt
    }
      , es = Bo.map({
        linear: ts,
        poly: Or,
        quad: function() {
            return jr
        },
        cubic: function() {
            return Hr
        },
        sin: function() {
            return Yr
        },
        exp: function() {
            return Ir
        },
        circle: function() {
            return Zr
        },
        elastic: Vr,
        back: Xr,
        bounce: function() {
            return $r
        }
    })
      , rs = Bo.map({
        "in": dt,
        out: Pr,
        "in-out": Ur,
        "out-in": function(n) {
            return Ur(Pr(n))
        }
    });
    Bo.ease = function(n) {
        var t = n.indexOf("-")
          , e = t >= 0 ? n.substring(0, t) : n
          , r = t >= 0 ? n.substring(t + 1) : "in";
        return e = es.get(e) || ts,
        r = rs.get(r) || dt,
        Dr(r(e.apply(null, Wo.call(arguments, 1))))
    }
    ,
    Bo.interpolateHcl = Br,
    Bo.interpolateHsl = Wr,
    Bo.interpolateLab = Jr,
    Bo.interpolateRound = Gr,
    Bo.transform = function(n) {
        var t = Go.createElementNS(Bo.ns.prefix.svg, "g");
        return (Bo.transform = function(n) {
            if (null != n) {
                t.setAttribute("transform", n);
                var e = t.transform.baseVal.consolidate()
            }
            return new Kr(e ? e.matrix : us)
        }
        )(n)
    }
    ,
    Kr.prototype.toString = function() {
        return "translate(" + this.translate + ")rotate(" + this.rotate + ")skewX(" + this.skew + ")scale(" + this.scale + ")"
    }
    ;
    var us = {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        e: 0,
        f: 0
    };
    Bo.interpolateTransform = eu,
    Bo.layout = {},
    Bo.layout.bundle = function() {
        return function(n) {
            for (var t = [], e = -1, r = n.length; ++e < r; )
                t.push(iu(n[e]));
            return t
        }
    }
    ,
    Bo.layout.chord = function() {
        function n() {
            var n, s, f, h, g, p = {}, v = [], d = Bo.range(i), m = [];
            for (e = [],
            r = [],
            n = 0,
            h = -1; ++h < i; ) {
                for (s = 0,
                g = -1; ++g < i; )
                    s += u[h][g];
                v.push(s),
                m.push(Bo.range(i)),
                n += s
            }
            for (o && d.sort(function(n, t) {
                return o(v[n], v[t])
            }),
            a && m.forEach(function(n, t) {
                n.sort(function(n, e) {
                    return a(u[t][n], u[t][e])
                })
            }),
            n = (Aa - l * i) / n,
            s = 0,
            h = -1; ++h < i; ) {
                for (f = s,
                g = -1; ++g < i; ) {
                    var y = d[h]
                      , x = m[y][g]
                      , M = u[y][x]
                      , _ = s
                      , b = s += M * n;
                    p[y + "-" + x] = {
                        index: y,
                        subindex: x,
                        startAngle: _,
                        endAngle: b,
                        value: M
                    }
                }
                r[y] = {
                    index: y,
                    startAngle: f,
                    endAngle: s,
                    value: (s - f) / n
                },
                s += l
            }
            for (h = -1; ++h < i; )
                for (g = h - 1; ++g < i; ) {
                    var w = p[h + "-" + g]
                      , S = p[g + "-" + h];
                    (w.value || S.value) && e.push(w.value < S.value ? {
                        source: S,
                        target: w
                    } : {
                        source: w,
                        target: S
                    })
                }
            c && t()
        }
        function t() {
            e.sort(function(n, t) {
                return c((n.source.value + n.target.value) / 2, (t.source.value + t.target.value) / 2)
            })
        }
        var e, r, u, i, o, a, c, s = {}, l = 0;
        return s.matrix = function(n) {
            return arguments.length ? (i = (u = n) && u.length,
            e = r = null,
            s) : u
        }
        ,
        s.padding = function(n) {
            return arguments.length ? (l = n,
            e = r = null,
            s) : l
        }
        ,
        s.sortGroups = function(n) {
            return arguments.length ? (o = n,
            e = r = null,
            s) : o
        }
        ,
        s.sortSubgroups = function(n) {
            return arguments.length ? (a = n,
            e = null,
            s) : a
        }
        ,
        s.sortChords = function(n) {
            return arguments.length ? (c = n,
            e && t(),
            s) : c
        }
        ,
        s.chords = function() {
            return e || n(),
            e
        }
        ,
        s.groups = function() {
            return r || n(),
            r
        }
        ,
        s
    }
    ,
    Bo.layout.force = function() {
        function n(n) {
            return function(t, e, r, u) {
                if (t.point !== n) {
                    var i = t.cx - n.x
                      , o = t.cy - n.y
                      , a = 1 / Math.sqrt(i * i + o * o);
                    if (v > (u - e) * a) {
                        var c = t.charge * a * a;
                        return n.px -= i * c,
                        n.py -= o * c,
                        !0
                    }
                    if (t.point && isFinite(a)) {
                        var c = t.pointCharge * a * a;
                        n.px -= i * c,
                        n.py -= o * c
                    }
                }
                return !t.charge
            }
        }
        function t(n) {
            n.px = Bo.event.x,
            n.py = Bo.event.y,
            a.resume()
        }
        var e, r, u, i, o, a = {}, c = Bo.dispatch("start", "tick", "end"), s = [1, 1], l = .9, f = is, h = os, g = -30, p = .1, v = .8, d = [], m = [];
        return a.tick = function() {
            if ((r *= .99) < .005)
                return c.end({
                    type: "end",
                    alpha: r = 0
                }),
                !0;
            var t, e, a, f, h, v, y, x, M, _ = d.length, b = m.length;
            for (e = 0; b > e; ++e)
                a = m[e],
                f = a.source,
                h = a.target,
                x = h.x - f.x,
                M = h.y - f.y,
                (v = x * x + M * M) && (v = r * i[e] * ((v = Math.sqrt(v)) - u[e]) / v,
                x *= v,
                M *= v,
                h.x -= x * (y = f.weight / (h.weight + f.weight)),
                h.y -= M * y,
                f.x += x * (y = 1 - y),
                f.y += M * y);
            if ((y = r * p) && (x = s[0] / 2,
            M = s[1] / 2,
            e = -1,
            y))
                for (; ++e < _; )
                    a = d[e],
                    a.x += (x - a.x) * y,
                    a.y += (M - a.y) * y;
            if (g)
                for (hu(t = Bo.geom.quadtree(d), r, o),
                e = -1; ++e < _; )
                    (a = d[e]).fixed || t.visit(n(a));
            for (e = -1; ++e < _; )
                a = d[e],
                a.fixed ? (a.x = a.px,
                a.y = a.py) : (a.x -= (a.px - (a.px = a.x)) * l,
                a.y -= (a.py - (a.py = a.y)) * l);
            c.tick({
                type: "tick",
                alpha: r
            })
        }
        ,
        a.nodes = function(n) {
            return arguments.length ? (d = n,
            a) : d
        }
        ,
        a.links = function(n) {
            return arguments.length ? (m = n,
            a) : m
        }
        ,
        a.size = function(n) {
            return arguments.length ? (s = n,
            a) : s
        }
        ,
        a.linkDistance = function(n) {
            return arguments.length ? (f = "function" == typeof n ? n : +n,
            a) : f
        }
        ,
        a.distance = a.linkDistance,
        a.linkStrength = function(n) {
            return arguments.length ? (h = "function" == typeof n ? n : +n,
            a) : h
        }
        ,
        a.friction = function(n) {
            return arguments.length ? (l = +n,
            a) : l
        }
        ,
        a.charge = function(n) {
            return arguments.length ? (g = "function" == typeof n ? n : +n,
            a) : g
        }
        ,
        a.gravity = function(n) {
            return arguments.length ? (p = +n,
            a) : p
        }
        ,
        a.theta = function(n) {
            return arguments.length ? (v = +n,
            a) : v
        }
        ,
        a.alpha = function(n) {
            return arguments.length ? (n = +n,
            r ? r = n > 0 ? n : 0 : n > 0 && (c.start({
                type: "start",
                alpha: r = n
            }),
            Bo.timer(a.tick)),
            a) : r
        }
        ,
        a.start = function() {
            function n(n, r) {
                if (!e) {
                    for (e = new Array(c),
                    a = 0; c > a; ++a)
                        e[a] = [];
                    for (a = 0; s > a; ++a) {
                        var u = m[a];
                        e[u.source.index].push(u.target),
                        e[u.target.index].push(u.source)
                    }
                }
                for (var i, o = e[t], a = -1, s = o.length; ++a < s; )
                    if (!isNaN(i = o[a][n]))
                        return i;
                return Math.random() * r
            }
            var t, e, r, c = d.length, l = m.length, p = s[0], v = s[1];
            for (t = 0; c > t; ++t)
                (r = d[t]).index = t,
                r.weight = 0;
            for (t = 0; l > t; ++t)
                r = m[t],
                "number" == typeof r.source && (r.source = d[r.source]),
                "number" == typeof r.target && (r.target = d[r.target]),
                ++r.source.weight,
                ++r.target.weight;
            for (t = 0; c > t; ++t)
                r = d[t],
                isNaN(r.x) && (r.x = n("x", p)),
                isNaN(r.y) && (r.y = n("y", v)),
                isNaN(r.px) && (r.px = r.x),
                isNaN(r.py) && (r.py = r.y);
            if (u = [],
            "function" == typeof f)
                for (t = 0; l > t; ++t)
                    u[t] = +f.call(this, m[t], t);
            else
                for (t = 0; l > t; ++t)
                    u[t] = f;
            if (i = [],
            "function" == typeof h)
                for (t = 0; l > t; ++t)
                    i[t] = +h.call(this, m[t], t);
            else
                for (t = 0; l > t; ++t)
                    i[t] = h;
            if (o = [],
            "function" == typeof g)
                for (t = 0; c > t; ++t)
                    o[t] = +g.call(this, d[t], t);
            else
                for (t = 0; c > t; ++t)
                    o[t] = g;
            return a.resume()
        }
        ,
        a.resume = function() {
            return a.alpha(.1)
        }
        ,
        a.stop = function() {
            return a.alpha(0)
        }
        ,
        a.drag = function() {
            return e || (e = Bo.behavior.drag().origin(dt).on("dragstart.force", cu).on("drag.force", t).on("dragend.force", su)),
            arguments.length ? (this.on("mouseover.force", lu).on("mouseout.force", fu).call(e),
            void 0) : e
        }
        ,
        Bo.rebind(a, c, "on")
    }
    ;
    var is = 20
      , os = 1;
    Bo.layout.hierarchy = function() {
        function n(t, o, a) {
            var c = u.call(e, t, o);
            if (t.depth = o,
            a.push(t),
            c && (s = c.length)) {
                for (var s, l, f = -1, h = t.children = new Array(s), g = 0, p = o + 1; ++f < s; )
                    l = h[f] = n(c[f], p, a),
                    l.parent = t,
                    g += l.value;
                r && h.sort(r),
                i && (t.value = g)
            } else
                delete t.children,
                i && (t.value = +i.call(e, t, o) || 0);
            return t
        }
        function t(n, r) {
            var u = n.children
              , o = 0;
            if (u && (a = u.length))
                for (var a, c = -1, s = r + 1; ++c < a; )
                    o += t(u[c], s);
            else
                i && (o = +i.call(e, n, r) || 0);
            return i && (n.value = o),
            o
        }
        function e(t) {
            var e = [];
            return n(t, 0, e),
            e
        }
        var r = du
          , u = pu
          , i = vu;
        return e.sort = function(n) {
            return arguments.length ? (r = n,
            e) : r
        }
        ,
        e.children = function(n) {
            return arguments.length ? (u = n,
            e) : u
        }
        ,
        e.value = function(n) {
            return arguments.length ? (i = n,
            e) : i
        }
        ,
        e.revalue = function(n) {
            return t(n, 0),
            n
        }
        ,
        e
    }
    ,
    Bo.layout.partition = function() {
        function n(t, e, r, u) {
            var i = t.children;
            if (t.x = e,
            t.y = t.depth * u,
            t.dx = r,
            t.dy = u,
            i && (o = i.length)) {
                var o, a, c, s = -1;
                for (r = t.value ? r / t.value : 0; ++s < o; )
                    n(a = i[s], e, c = a.value * r, u),
                    e += c
            }
        }
        function t(n) {
            var e = n.children
              , r = 0;
            if (e && (u = e.length))
                for (var u, i = -1; ++i < u; )
                    r = Math.max(r, t(e[i]));
            return 1 + r
        }
        function e(e, i) {
            var o = r.call(this, e, i);
            return n(o[0], 0, u[0], u[1] / t(o[0])),
            o
        }
        var r = Bo.layout.hierarchy()
          , u = [1, 1];
        return e.size = function(n) {
            return arguments.length ? (u = n,
            e) : u
        }
        ,
        gu(e, r)
    }
    ,
    Bo.layout.pie = function() {
        function n(i) {
            var o = i.map(function(e, r) {
                return +t.call(n, e, r)
            })
              , a = +("function" == typeof r ? r.apply(this, arguments) : r)
              , c = (("function" == typeof u ? u.apply(this, arguments) : u) - a) / Bo.sum(o)
              , s = Bo.range(i.length);
            null != e && s.sort(e === as ? function(n, t) {
                return o[t] - o[n]
            }
            : function(n, t) {
                return e(i[n], i[t])
            }
            );
            var l = [];
            return s.forEach(function(n) {
                var t;
                l[n] = {
                    data: i[n],
                    value: t = o[n],
                    startAngle: a,
                    endAngle: a += t * c
                }
            }),
            l
        }
        var t = Number
          , e = as
          , r = 0
          , u = Aa;
        return n.value = function(e) {
            return arguments.length ? (t = e,
            n) : t
        }
        ,
        n.sort = function(t) {
            return arguments.length ? (e = t,
            n) : e
        }
        ,
        n.startAngle = function(t) {
            return arguments.length ? (r = t,
            n) : r
        }
        ,
        n.endAngle = function(t) {
            return arguments.length ? (u = t,
            n) : u
        }
        ,
        n
    }
    ;
    var as = {};
    Bo.layout.stack = function() {
        function n(a, c) {
            var s = a.map(function(e, r) {
                return t.call(n, e, r)
            })
              , l = s.map(function(t) {
                return t.map(function(t, e) {
                    return [i.call(n, t, e), o.call(n, t, e)]
                })
            })
              , f = e.call(n, l, c);
            s = Bo.permute(s, f),
            l = Bo.permute(l, f);
            var h, g, p, v = r.call(n, l, c), d = s.length, m = s[0].length;
            for (g = 0; m > g; ++g)
                for (u.call(n, s[0][g], p = v[g], l[0][g][1]),
                h = 1; d > h; ++h)
                    u.call(n, s[h][g], p += l[h - 1][g][1], l[h][g][1]);
            return a
        }
        var t = dt
          , e = _u
          , r = bu
          , u = Mu
          , i = yu
          , o = xu;
        return n.values = function(e) {
            return arguments.length ? (t = e,
            n) : t
        }
        ,
        n.order = function(t) {
            return arguments.length ? (e = "function" == typeof t ? t : cs.get(t) || _u,
            n) : e
        }
        ,
        n.offset = function(t) {
            return arguments.length ? (r = "function" == typeof t ? t : ss.get(t) || bu,
            n) : r
        }
        ,
        n.x = function(t) {
            return arguments.length ? (i = t,
            n) : i
        }
        ,
        n.y = function(t) {
            return arguments.length ? (o = t,
            n) : o
        }
        ,
        n.out = function(t) {
            return arguments.length ? (u = t,
            n) : u
        }
        ,
        n
    }
    ;
    var cs = Bo.map({
        "inside-out": function(n) {
            var t, e, r = n.length, u = n.map(wu), i = n.map(Su), o = Bo.range(r).sort(function(n, t) {
                return u[n] - u[t]
            }), a = 0, c = 0, s = [], l = [];
            for (t = 0; r > t; ++t)
                e = o[t],
                c > a ? (a += i[e],
                s.push(e)) : (c += i[e],
                l.push(e));
            return l.reverse().concat(s)
        },
        reverse: function(n) {
            return Bo.range(n.length).reverse()
        },
        "default": _u
    })
      , ss = Bo.map({
        silhouette: function(n) {
            var t, e, r, u = n.length, i = n[0].length, o = [], a = 0, c = [];
            for (e = 0; i > e; ++e) {
                for (t = 0,
                r = 0; u > t; t++)
                    r += n[t][e][1];
                r > a && (a = r),
                o.push(r)
            }
            for (e = 0; i > e; ++e)
                c[e] = (a - o[e]) / 2;
            return c
        },
        wiggle: function(n) {
            var t, e, r, u, i, o, a, c, s, l = n.length, f = n[0], h = f.length, g = [];
            for (g[0] = c = s = 0,
            e = 1; h > e; ++e) {
                for (t = 0,
                u = 0; l > t; ++t)
                    u += n[t][e][1];
                for (t = 0,
                i = 0,
                a = f[e][0] - f[e - 1][0]; l > t; ++t) {
                    for (r = 0,
                    o = (n[t][e][1] - n[t][e - 1][1]) / (2 * a); t > r; ++r)
                        o += (n[r][e][1] - n[r][e - 1][1]) / a;
                    i += o * n[t][e][1]
                }
                g[e] = c -= u ? i / u * a : 0,
                s > c && (s = c)
            }
            for (e = 0; h > e; ++e)
                g[e] -= s;
            return g
        },
        expand: function(n) {
            var t, e, r, u = n.length, i = n[0].length, o = 1 / u, a = [];
            for (e = 0; i > e; ++e) {
                for (t = 0,
                r = 0; u > t; t++)
                    r += n[t][e][1];
                if (r)
                    for (t = 0; u > t; t++)
                        n[t][e][1] /= r;
                else
                    for (t = 0; u > t; t++)
                        n[t][e][1] = o
            }
            for (e = 0; i > e; ++e)
                a[e] = 0;
            return a
        },
        zero: bu
    });
    Bo.layout.histogram = function() {
        function n(n, i) {
            for (var o, a, c = [], s = n.map(e, this), l = r.call(this, s, i), f = u.call(this, l, s, i), i = -1, h = s.length, g = f.length - 1, p = t ? 1 : 1 / h; ++i < g; )
                o = c[i] = [],
                o.dx = f[i + 1] - (o.x = f[i]),
                o.y = 0;
            if (g > 0)
                for (i = -1; ++i < h; )
                    a = s[i],
                    a >= l[0] && a <= l[1] && (o = c[Bo.bisect(f, a, 1, g) - 1],
                    o.y += p,
                    o.push(n[i]));
            return c
        }
        var t = !0
          , e = Number
          , r = Cu
          , u = Eu;
        return n.value = function(t) {
            return arguments.length ? (e = t,
            n) : e
        }
        ,
        n.range = function(t) {
            return arguments.length ? (r = vt(t),
            n) : r
        }
        ,
        n.bins = function(t) {
            return arguments.length ? (u = "number" == typeof t ? function(n) {
                return Au(n, t)
            }
            : vt(t),
            n) : u
        }
        ,
        n.frequency = function(e) {
            return arguments.length ? (t = !!e,
            n) : t
        }
        ,
        n
    }
    ,
    Bo.layout.tree = function() {
        function n(n, i) {
            function o(n, t) {
                var r = n.children
                  , u = n._tree;
                if (r && (i = r.length)) {
                    for (var i, a, s, l = r[0], f = l, h = -1; ++h < i; )
                        s = r[h],
                        o(s, a),
                        f = c(s, a, f),
                        a = s;
                    Uu(n);
                    var g = .5 * (l._tree.prelim + s._tree.prelim);
                    t ? (u.prelim = t._tree.prelim + e(n, t),
                    u.mod = u.prelim - g) : u.prelim = g
                } else
                    t && (u.prelim = t._tree.prelim + e(n, t))
            }
            function a(n, t) {
                n.x = n._tree.prelim + t;
                var e = n.children;
                if (e && (r = e.length)) {
                    var r, u = -1;
                    for (t += n._tree.mod; ++u < r; )
                        a(e[u], t)
                }
            }
            function c(n, t, r) {
                if (t) {
                    for (var u, i = n, o = n, a = t, c = n.parent.children[0], s = i._tree.mod, l = o._tree.mod, f = a._tree.mod, h = c._tree.mod; a = Tu(a),
                    i = Lu(i),
                    a && i; )
                        c = Lu(c),
                        o = Tu(o),
                        o._tree.ancestor = n,
                        u = a._tree.prelim + f - i._tree.prelim - s + e(a, i),
                        u > 0 && (ju(Hu(a, n, r), n, u),
                        s += u,
                        l += u),
                        f += a._tree.mod,
                        s += i._tree.mod,
                        h += c._tree.mod,
                        l += o._tree.mod;
                    a && !Tu(o) && (o._tree.thread = a,
                    o._tree.mod += f - l),
                    i && !Lu(c) && (c._tree.thread = i,
                    c._tree.mod += s - h,
                    r = n)
                }
                return r
            }
            var s = t.call(this, n, i)
              , l = s[0];
            Pu(l, function(n, t) {
                n._tree = {
                    ancestor: n,
                    prelim: 0,
                    mod: 0,
                    change: 0,
                    shift: 0,
                    number: t ? t._tree.number + 1 : 0
                }
            }),
            o(l),
            a(l, -l._tree.prelim);
            var f = qu(l, Ru)
              , h = qu(l, zu)
              , g = qu(l, Du)
              , p = f.x - e(f, h) / 2
              , v = h.x + e(h, f) / 2
              , d = g.depth || 1;
            return Pu(l, u ? function(n) {
                n.x *= r[0],
                n.y = n.depth * r[1],
                delete n._tree
            }
            : function(n) {
                n.x = (n.x - p) / (v - p) * r[0],
                n.y = n.depth / d * r[1],
                delete n._tree
            }
            ),
            s
        }
        var t = Bo.layout.hierarchy().sort(null).value(null)
          , e = Nu
          , r = [1, 1]
          , u = !1;
        return n.separation = function(t) {
            return arguments.length ? (e = t,
            n) : e
        }
        ,
        n.size = function(t) {
            return arguments.length ? (u = null == (r = t),
            n) : u ? null : r
        }
        ,
        n.nodeSize = function(t) {
            return arguments.length ? (u = null != (r = t),
            n) : u ? r : null
        }
        ,
        gu(n, t)
    }
    ,
    Bo.layout.pack = function() {
        function n(n, i) {
            var o = e.call(this, n, i)
              , a = o[0]
              , c = u[0]
              , s = u[1]
              , l = null == t ? Math.sqrt : "function" == typeof t ? t : function() {
                return t
            }
            ;
            if (a.x = a.y = 0,
            Pu(a, function(n) {
                n.r = +l(n.value)
            }),
            Pu(a, Zu),
            r) {
                var f = r * (t ? 1 : Math.max(2 * a.r / c, 2 * a.r / s)) / 2;
                Pu(a, function(n) {
                    n.r += f
                }),
                Pu(a, Zu),
                Pu(a, function(n) {
                    n.r -= f
                })
            }
            return $u(a, c / 2, s / 2, t ? 1 : 1 / Math.max(2 * a.r / c, 2 * a.r / s)),
            o
        }
        var t, e = Bo.layout.hierarchy().sort(Fu), r = 0, u = [1, 1];
        return n.size = function(t) {
            return arguments.length ? (u = t,
            n) : u
        }
        ,
        n.radius = function(e) {
            return arguments.length ? (t = null == e || "function" == typeof e ? e : +e,
            n) : t
        }
        ,
        n.padding = function(t) {
            return arguments.length ? (r = +t,
            n) : r
        }
        ,
        gu(n, e)
    }
    ,
    Bo.layout.cluster = function() {
        function n(n, i) {
            var o, a = t.call(this, n, i), c = a[0], s = 0;
            Pu(c, function(n) {
                var t = n.children;
                t && t.length ? (n.x = Ju(t),
                n.y = Wu(t)) : (n.x = o ? s += e(n, o) : 0,
                n.y = 0,
                o = n)
            });
            var l = Gu(c)
              , f = Ku(c)
              , h = l.x - e(l, f) / 2
              , g = f.x + e(f, l) / 2;
            return Pu(c, u ? function(n) {
                n.x = (n.x - c.x) * r[0],
                n.y = (c.y - n.y) * r[1]
            }
            : function(n) {
                n.x = (n.x - h) / (g - h) * r[0],
                n.y = (1 - (c.y ? n.y / c.y : 1)) * r[1]
            }
            ),
            a
        }
        var t = Bo.layout.hierarchy().sort(null).value(null)
          , e = Nu
          , r = [1, 1]
          , u = !1;
        return n.separation = function(t) {
            return arguments.length ? (e = t,
            n) : e
        }
        ,
        n.size = function(t) {
            return arguments.length ? (u = null == (r = t),
            n) : u ? null : r
        }
        ,
        n.nodeSize = function(t) {
            return arguments.length ? (u = null != (r = t),
            n) : u ? r : null
        }
        ,
        gu(n, t)
    }
    ,
    Bo.layout.treemap = function() {
        function n(n, t) {
            for (var e, r, u = -1, i = n.length; ++u < i; )
                r = (e = n[u]).value * (0 > t ? 0 : t),
                e.area = isNaN(r) || 0 >= r ? 0 : r
        }
        function t(e) {
            var i = e.children;
            if (i && i.length) {
                var o, a, c, s = f(e), l = [], h = i.slice(), p = 1 / 0, v = "slice" === g ? s.dx : "dice" === g ? s.dy : "slice-dice" === g ? 1 & e.depth ? s.dy : s.dx : Math.min(s.dx, s.dy);
                for (n(h, s.dx * s.dy / e.value),
                l.area = 0; (c = h.length) > 0; )
                    l.push(o = h[c - 1]),
                    l.area += o.area,
                    "squarify" !== g || (a = r(l, v)) <= p ? (h.pop(),
                    p = a) : (l.area -= l.pop().area,
                    u(l, v, s, !1),
                    v = Math.min(s.dx, s.dy),
                    l.length = l.area = 0,
                    p = 1 / 0);
                l.length && (u(l, v, s, !0),
                l.length = l.area = 0),
                i.forEach(t)
            }
        }
        function e(t) {
            var r = t.children;
            if (r && r.length) {
                var i, o = f(t), a = r.slice(), c = [];
                for (n(a, o.dx * o.dy / t.value),
                c.area = 0; i = a.pop(); )
                    c.push(i),
                    c.area += i.area,
                    null != i.z && (u(c, i.z ? o.dx : o.dy, o, !a.length),
                    c.length = c.area = 0);
                r.forEach(e)
            }
        }
        function r(n, t) {
            for (var e, r = n.area, u = 0, i = 1 / 0, o = -1, a = n.length; ++o < a; )
                (e = n[o].area) && (i > e && (i = e),
                e > u && (u = e));
            return r *= r,
            t *= t,
            r ? Math.max(t * u * p / r, r / (t * i * p)) : 1 / 0
        }
        function u(n, t, e, r) {
            var u, i = -1, o = n.length, a = e.x, s = e.y, l = t ? c(n.area / t) : 0;
            if (t == e.dx) {
                for ((r || l > e.dy) && (l = e.dy); ++i < o; )
                    u = n[i],
                    u.x = a,
                    u.y = s,
                    u.dy = l,
                    a += u.dx = Math.min(e.x + e.dx - a, l ? c(u.area / l) : 0);
                u.z = !0,
                u.dx += e.x + e.dx - a,
                e.y += l,
                e.dy -= l
            } else {
                for ((r || l > e.dx) && (l = e.dx); ++i < o; )
                    u = n[i],
                    u.x = a,
                    u.y = s,
                    u.dx = l,
                    s += u.dy = Math.min(e.y + e.dy - s, l ? c(u.area / l) : 0);
                u.z = !1,
                u.dy += e.y + e.dy - s,
                e.x += l,
                e.dx -= l
            }
        }
        function i(r) {
            var u = o || a(r)
              , i = u[0];
            return i.x = 0,
            i.y = 0,
            i.dx = s[0],
            i.dy = s[1],
            o && a.revalue(i),
            n([i], i.dx * i.dy / i.value),
            (o ? e : t)(i),
            h && (o = u),
            u
        }
        var o, a = Bo.layout.hierarchy(), c = Math.round, s = [1, 1], l = null, f = Qu, h = !1, g = "squarify", p = .5 * (1 + Math.sqrt(5));
        return i.size = function(n) {
            return arguments.length ? (s = n,
            i) : s
        }
        ,
        i.padding = function(n) {
            function t(t) {
                var e = n.call(i, t, t.depth);
                return null == e ? Qu(t) : ni(t, "number" == typeof e ? [e, e, e, e] : e)
            }
            function e(t) {
                return ni(t, n)
            }
            if (!arguments.length)
                return l;
            var r;
            return f = null == (l = n) ? Qu : "function" == (r = typeof n) ? t : "number" === r ? (n = [n, n, n, n],
            e) : e,
            i
        }
        ,
        i.round = function(n) {
            return arguments.length ? (c = n ? Math.round : Number,
            i) : c != Number
        }
        ,
        i.sticky = function(n) {
            return arguments.length ? (h = n,
            o = null,
            i) : h
        }
        ,
        i.ratio = function(n) {
            return arguments.length ? (p = n,
            i) : p
        }
        ,
        i.mode = function(n) {
            return arguments.length ? (g = n + "",
            i) : g
        }
        ,
        gu(i, a)
    }
    ,
    Bo.random = {
        normal: function(n, t) {
            var e = arguments.length;
            return 2 > e && (t = 1),
            1 > e && (n = 0),
            function() {
                var e, r, u;
                do
                    e = 2 * Math.random() - 1,
                    r = 2 * Math.random() - 1,
                    u = e * e + r * r;
                while (!u || u > 1);
                return n + t * e * Math.sqrt(-2 * Math.log(u) / u)
            }
        },
        logNormal: function() {
            var n = Bo.random.normal.apply(Bo, arguments);
            return function() {
                return Math.exp(n())
            }
        },
        bates: function(n) {
            var t = Bo.random.irwinHall(n);
            return function() {
                return t() / n
            }
        },
        irwinHall: function(n) {
            return function() {
                for (var t = 0, e = 0; n > e; e++)
                    t += Math.random();
                return t
            }
        }
    },
    Bo.scale = {};
    var ls = {
        floor: dt,
        ceil: dt
    };
    Bo.scale.linear = function() {
        return ai([0, 1], [0, 1], zr, !1)
    }
    ;
    var fs = {
        s: 1,
        g: 1,
        p: 1,
        r: 1,
        e: 1
    };
    Bo.scale.log = function() {
        return vi(Bo.scale.linear().domain([0, 1]), 10, !0, [1, 10])
    }
    ;
    var hs = Bo.format(".0e")
      , gs = {
        floor: function(n) {
            return -Math.ceil(-n)
        },
        ceil: function(n) {
            return -Math.floor(-n)
        }
    };
    Bo.scale.pow = function() {
        return di(Bo.scale.linear(), 1, [0, 1])
    }
    ,
    Bo.scale.sqrt = function() {
        return Bo.scale.pow().exponent(.5)
    }
    ,
    Bo.scale.ordinal = function() {
        return yi([], {
            t: "range",
            a: [[]]
        })
    }
    ,
    Bo.scale.category10 = function() {
        return Bo.scale.ordinal().range(ps)
    }
    ,
    Bo.scale.category20 = function() {
        return Bo.scale.ordinal().range(vs)
    }
    ,
    Bo.scale.category20b = function() {
        return Bo.scale.ordinal().range(ds)
    }
    ,
    Bo.scale.category20c = function() {
        return Bo.scale.ordinal().range(ms)
    }
    ;
    var ps = [2062260, 16744206, 2924588, 14034728, 9725885, 9197131, 14907330, 8355711, 12369186, 1556175].map(ot)
      , vs = [2062260, 11454440, 16744206, 16759672, 2924588, 10018698, 14034728, 16750742, 9725885, 12955861, 9197131, 12885140, 14907330, 16234194, 8355711, 13092807, 12369186, 14408589, 1556175, 10410725].map(ot)
      , ds = [3750777, 5395619, 7040719, 10264286, 6519097, 9216594, 11915115, 13556636, 9202993, 12426809, 15186514, 15190932, 8666169, 11356490, 14049643, 15177372, 8077683, 10834324, 13528509, 14589654].map(ot)
      , ms = [3244733, 7057110, 10406625, 13032431, 15095053, 16616764, 16625259, 16634018, 3253076, 7652470, 10607003, 13101504, 7695281, 10394312, 12369372, 14342891, 6513507, 9868950, 12434877, 14277081].map(ot);
    Bo.scale.quantile = function() {
        return xi([], [])
    }
    ,
    Bo.scale.quantize = function() {
        return Mi(0, 1, [0, 1])
    }
    ,
    Bo.scale.threshold = function() {
        return _i([.5], [0, 1])
    }
    ,
    Bo.scale.identity = function() {
        return bi([0, 1])
    }
    ,
    Bo.svg = {},
    Bo.svg.arc = function() {
        function n() {
            var n = t.apply(this, arguments)
              , i = e.apply(this, arguments)
              , o = r.apply(this, arguments) + ys
              , a = u.apply(this, arguments) + ys
              , c = (o > a && (c = o,
            o = a,
            a = c),
            a - o)
              , s = Ea > c ? "0" : "1"
              , l = Math.cos(o)
              , f = Math.sin(o)
              , h = Math.cos(a)
              , g = Math.sin(a);
            return c >= xs ? n ? "M0," + i + "A" + i + "," + i + " 0 1,1 0," + -i + "A" + i + "," + i + " 0 1,1 0," + i + "M0," + n + "A" + n + "," + n + " 0 1,0 0," + -n + "A" + n + "," + n + " 0 1,0 0," + n + "Z" : "M0," + i + "A" + i + "," + i + " 0 1,1 0," + -i + "A" + i + "," + i + " 0 1,1 0," + i + "Z" : n ? "M" + i * l + "," + i * f + "A" + i + "," + i + " 0 " + s + ",1 " + i * h + "," + i * g + "L" + n * h + "," + n * g + "A" + n + "," + n + " 0 " + s + ",0 " + n * l + "," + n * f + "Z" : "M" + i * l + "," + i * f + "A" + i + "," + i + " 0 " + s + ",1 " + i * h + "," + i * g + "L0,0" + "Z"
        }
        var t = wi
          , e = Si
          , r = ki
          , u = Ei;
        return n.innerRadius = function(e) {
            return arguments.length ? (t = vt(e),
            n) : t
        }
        ,
        n.outerRadius = function(t) {
            return arguments.length ? (e = vt(t),
            n) : e
        }
        ,
        n.startAngle = function(t) {
            return arguments.length ? (r = vt(t),
            n) : r
        }
        ,
        n.endAngle = function(t) {
            return arguments.length ? (u = vt(t),
            n) : u
        }
        ,
        n.centroid = function() {
            var n = (t.apply(this, arguments) + e.apply(this, arguments)) / 2
              , i = (r.apply(this, arguments) + u.apply(this, arguments)) / 2 + ys;
            return [Math.cos(i) * n, Math.sin(i) * n]
        }
        ,
        n
    }
    ;
    var ys = -Ca
      , xs = Aa - Na;
    Bo.svg.line = function() {
        return Ai(dt)
    }
    ;
    var Ms = Bo.map({
        linear: Ci,
        "linear-closed": Ni,
        step: Li,
        "step-before": Ti,
        "step-after": qi,
        basis: ji,
        "basis-open": Hi,
        "basis-closed": Fi,
        bundle: Oi,
        cardinal: Di,
        "cardinal-open": zi,
        "cardinal-closed": Ri,
        monotone: $i
    });
    Ms.forEach(function(n, t) {
        t.key = n,
        t.closed = /-closed$/.test(n)
    });
    var _s = [0, 2 / 3, 1 / 3, 0]
      , bs = [0, 1 / 3, 2 / 3, 0]
      , ws = [0, 1 / 6, 2 / 3, 1 / 6];
    Bo.svg.line.radial = function() {
        var n = Ai(Bi);
        return n.radius = n.x,
        delete n.x,
        n.angle = n.y,
        delete n.y,
        n
    }
    ,
    Ti.reverse = qi,
    qi.reverse = Ti,
    Bo.svg.area = function() {
        return Wi(dt)
    }
    ,
    Bo.svg.area.radial = function() {
        var n = Wi(Bi);
        return n.radius = n.x,
        delete n.x,
        n.innerRadius = n.x0,
        delete n.x0,
        n.outerRadius = n.x1,
        delete n.x1,
        n.angle = n.y,
        delete n.y,
        n.startAngle = n.y0,
        delete n.y0,
        n.endAngle = n.y1,
        delete n.y1,
        n
    }
    ,
    Bo.svg.chord = function() {
        function n(n, a) {
            var c = t(this, i, n, a)
              , s = t(this, o, n, a);
            return "M" + c.p0 + r(c.r, c.p1, c.a1 - c.a0) + (e(c, s) ? u(c.r, c.p1, c.r, c.p0) : u(c.r, c.p1, s.r, s.p0) + r(s.r, s.p1, s.a1 - s.a0) + u(s.r, s.p1, c.r, c.p0)) + "Z"
        }
        function t(n, t, e, r) {
            var u = t.call(n, e, r)
              , i = a.call(n, u, r)
              , o = c.call(n, u, r) + ys
              , l = s.call(n, u, r) + ys;
            return {
                r: i,
                a0: o,
                a1: l,
                p0: [i * Math.cos(o), i * Math.sin(o)],
                p1: [i * Math.cos(l), i * Math.sin(l)]
            }
        }
        function e(n, t) {
            return n.a0 == t.a0 && n.a1 == t.a1
        }
        function r(n, t, e) {
            return "A" + n + "," + n + " 0 " + +(e > Ea) + ",1 " + t
        }
        function u(n, t, e, r) {
            return "Q 0,0 " + r
        }
        var i = De
          , o = Pe
          , a = Ji
          , c = ki
          , s = Ei;
        return n.radius = function(t) {
            return arguments.length ? (a = vt(t),
            n) : a
        }
        ,
        n.source = function(t) {
            return arguments.length ? (i = vt(t),
            n) : i
        }
        ,
        n.target = function(t) {
            return arguments.length ? (o = vt(t),
            n) : o
        }
        ,
        n.startAngle = function(t) {
            return arguments.length ? (c = vt(t),
            n) : c
        }
        ,
        n.endAngle = function(t) {
            return arguments.length ? (s = vt(t),
            n) : s
        }
        ,
        n
    }
    ,
    Bo.svg.diagonal = function() {
        function n(n, u) {
            var i = t.call(this, n, u)
              , o = e.call(this, n, u)
              , a = (i.y + o.y) / 2
              , c = [i, {
                x: i.x,
                y: a
            }, {
                x: o.x,
                y: a
            }, o];
            return c = c.map(r),
            "M" + c[0] + "C" + c[1] + " " + c[2] + " " + c[3]
        }
        var t = De
          , e = Pe
          , r = Gi;
        return n.source = function(e) {
            return arguments.length ? (t = vt(e),
            n) : t
        }
        ,
        n.target = function(t) {
            return arguments.length ? (e = vt(t),
            n) : e
        }
        ,
        n.projection = function(t) {
            return arguments.length ? (r = t,
            n) : r
        }
        ,
        n
    }
    ,
    Bo.svg.diagonal.radial = function() {
        var n = Bo.svg.diagonal()
          , t = Gi
          , e = n.projection;
        return n.projection = function(n) {
            return arguments.length ? e(Ki(t = n)) : t
        }
        ,
        n
    }
    ,
    Bo.svg.symbol = function() {
        function n(n, r) {
            return (Ss.get(t.call(this, n, r)) || to)(e.call(this, n, r))
        }
        var t = no
          , e = Qi;
        return n.type = function(e) {
            return arguments.length ? (t = vt(e),
            n) : t
        }
        ,
        n.size = function(t) {
            return arguments.length ? (e = vt(t),
            n) : e
        }
        ,
        n
    }
    ;
    var Ss = Bo.map({
        circle: to,
        cross: function(n) {
            var t = Math.sqrt(n / 5) / 2;
            return "M" + -3 * t + "," + -t + "H" + -t + "V" + -3 * t + "H" + t + "V" + -t + "H" + 3 * t + "V" + t + "H" + t + "V" + 3 * t + "H" + -t + "V" + t + "H" + -3 * t + "Z"
        },
        diamond: function(n) {
            var t = Math.sqrt(n / (2 * Cs))
              , e = t * Cs;
            return "M0," + -t + "L" + e + ",0" + " 0," + t + " " + -e + ",0" + "Z"
        },
        square: function(n) {
            var t = Math.sqrt(n) / 2;
            return "M" + -t + "," + -t + "L" + t + "," + -t + " " + t + "," + t + " " + -t + "," + t + "Z"
        },
        "triangle-down": function(n) {
            var t = Math.sqrt(n / As)
              , e = t * As / 2;
            return "M0," + e + "L" + t + "," + -e + " " + -t + "," + -e + "Z"
        },
        "triangle-up": function(n) {
            var t = Math.sqrt(n / As)
              , e = t * As / 2;
            return "M0," + -e + "L" + t + "," + e + " " + -t + "," + e + "Z"
        }
    });
    Bo.svg.symbolTypes = Ss.keys();
    var ks, Es, As = Math.sqrt(3), Cs = Math.tan(30 * Ta), Ns = [], Ls = 0;
    Ns.call = ya.call,
    Ns.empty = ya.empty,
    Ns.node = ya.node,
    Ns.size = ya.size,
    Bo.transition = function(n) {
        return arguments.length ? ks ? n.transition() : n : _a.transition()
    }
    ,
    Bo.transition.prototype = Ns,
    Ns.select = function(n) {
        var t, e, r, u = this.id, i = [];
        n = v(n);
        for (var o = -1, a = this.length; ++o < a; ) {
            i.push(t = []);
            for (var c = this[o], s = -1, l = c.length; ++s < l; )
                (r = c[s]) && (e = n.call(r, r.__data__, s, o)) ? ("__data__"in r && (e.__data__ = r.__data__),
                io(e, s, u, r.__transition__[u]),
                t.push(e)) : t.push(null)
        }
        return eo(i, u)
    }
    ,
    Ns.selectAll = function(n) {
        var t, e, r, u, i, o = this.id, a = [];
        n = d(n);
        for (var c = -1, s = this.length; ++c < s; )
            for (var l = this[c], f = -1, h = l.length; ++f < h; )
                if (r = l[f]) {
                    i = r.__transition__[o],
                    e = n.call(r, r.__data__, f, c),
                    a.push(t = []);
                    for (var g = -1, p = e.length; ++g < p; )
                        (u = e[g]) && io(u, g, o, i),
                        t.push(u)
                }
        return eo(a, o)
    }
    ,
    Ns.filter = function(n) {
        var t, e, r, u = [];
        "function" != typeof n && (n = A(n));
        for (var i = 0, o = this.length; o > i; i++) {
            u.push(t = []);
            for (var e = this[i], a = 0, c = e.length; c > a; a++)
                (r = e[a]) && n.call(r, r.__data__, a, i) && t.push(r)
        }
        return eo(u, this.id)
    }
    ,
    Ns.tween = function(n, t) {
        var e = this.id;
        return arguments.length < 2 ? this.node().__transition__[e].tween.get(n) : N(this, null == t ? function(t) {
            t.__transition__[e].tween.remove(n)
        }
        : function(r) {
            r.__transition__[e].tween.set(n, t)
        }
        )
    }
    ,
    Ns.attr = function(n, t) {
        function e() {
            this.removeAttribute(a)
        }
        function r() {
            this.removeAttributeNS(a.space, a.local)
        }
        function u(n) {
            return null == n ? e : (n += "",
            function() {
                var t, e = this.getAttribute(a);
                return e !== n && (t = o(e, n),
                function(n) {
                    this.setAttribute(a, t(n))
                }
                )
            }
            )
        }
        function i(n) {
            return null == n ? r : (n += "",
            function() {
                var t, e = this.getAttributeNS(a.space, a.local);
                return e !== n && (t = o(e, n),
                function(n) {
                    this.setAttributeNS(a.space, a.local, t(n))
                }
                )
            }
            )
        }
        if (arguments.length < 2) {
            for (t in n)
                this.attr(t, n[t]);
            return this
        }
        var o = "transform" == n ? eu : zr
          , a = Bo.ns.qualify(n);
        return ro(this, "attr." + n, t, a.local ? i : u)
    }
    ,
    Ns.attrTween = function(n, t) {
        function e(n, e) {
            var r = t.call(this, n, e, this.getAttribute(u));
            return r && function(n) {
                this.setAttribute(u, r(n))
            }
        }
        function r(n, e) {
            var r = t.call(this, n, e, this.getAttributeNS(u.space, u.local));
            return r && function(n) {
                this.setAttributeNS(u.space, u.local, r(n))
            }
        }
        var u = Bo.ns.qualify(n);
        return this.tween("attr." + n, u.local ? r : e)
    }
    ,
    Ns.style = function(n, t, e) {
        function r() {
            this.style.removeProperty(n)
        }
        function u(t) {
            return null == t ? r : (t += "",
            function() {
                var r, u = Qo.getComputedStyle(this, null).getPropertyValue(n);
                return u !== t && (r = zr(u, t),
                function(t) {
                    this.style.setProperty(n, r(t), e)
                }
                )
            }
            )
        }
        var i = arguments.length;
        if (3 > i) {
            if ("string" != typeof n) {
                2 > i && (t = "");
                for (e in n)
                    this.style(e, n[e], t);
                return this
            }
            e = ""
        }
        return ro(this, "style." + n, t, u)
    }
    ,
    Ns.styleTween = function(n, t, e) {
        function r(r, u) {
            var i = t.call(this, r, u, Qo.getComputedStyle(this, null).getPropertyValue(n));
            return i && function(t) {
                this.style.setProperty(n, i(t), e)
            }
        }
        return arguments.length < 3 && (e = ""),
        this.tween("style." + n, r)
    }
    ,
    Ns.text = function(n) {
        return ro(this, "text", n, uo)
    }
    ,
    Ns.remove = function() {
        return this.each("end.transition", function() {
            var n;
            this.__transition__.count < 2 && (n = this.parentNode) && n.removeChild(this)
        })
    }
    ,
    Ns.ease = function(n) {
        var t = this.id;
        return arguments.length < 1 ? this.node().__transition__[t].ease : ("function" != typeof n && (n = Bo.ease.apply(Bo, arguments)),
        N(this, function(e) {
            e.__transition__[t].ease = n
        }))
    }
    ,
    Ns.delay = function(n) {
        var t = this.id;
        return N(this, "function" == typeof n ? function(e, r, u) {
            e.__transition__[t].delay = +n.call(e, e.__data__, r, u)
        }
        : (n = +n,
        function(e) {
            e.__transition__[t].delay = n
        }
        ))
    }
    ,
    Ns.duration = function(n) {
        var t = this.id;
        return N(this, "function" == typeof n ? function(e, r, u) {
            e.__transition__[t].duration = Math.max(1, n.call(e, e.__data__, r, u))
        }
        : (n = Math.max(1, n),
        function(e) {
            e.__transition__[t].duration = n
        }
        ))
    }
    ,
    Ns.each = function(n, t) {
        var e = this.id;
        if (arguments.length < 2) {
            var r = Es
              , u = ks;
            ks = e,
            N(this, function(t, r, u) {
                Es = t.__transition__[e],
                n.call(t, t.__data__, r, u)
            }),
            Es = r,
            ks = u
        } else
            N(this, function(r) {
                var u = r.__transition__[e];
                (u.event || (u.event = Bo.dispatch("start", "end"))).on(n, t)
            });
        return this
    }
    ,
    Ns.transition = function() {
        for (var n, t, e, r, u = this.id, i = ++Ls, o = [], a = 0, c = this.length; c > a; a++) {
            o.push(n = []);
            for (var t = this[a], s = 0, l = t.length; l > s; s++)
                (e = t[s]) && (r = Object.create(e.__transition__[u]),
                r.delay += r.duration,
                io(e, s, i, r)),
                n.push(e)
        }
        return eo(o, i)
    }
    ,
    Bo.svg.axis = function() {
        function n(n) {
            n.each(function() {
                var n, s = Bo.select(this), l = this.__chart__ || e, f = this.__chart__ = e.copy(), h = null == c ? f.ticks ? f.ticks.apply(f, a) : f.domain() : c, g = null == t ? f.tickFormat ? f.tickFormat.apply(f, a) : dt : t, p = s.selectAll(".tick").data(h, f), v = p.enter().insert("g", ".domain").attr("class", "tick").style("opacity", Na), d = Bo.transition(p.exit()).style("opacity", Na).remove(), m = Bo.transition(p).style("opacity", 1), y = ei(f), x = s.selectAll(".domain").data([0]), M = (x.enter().append("path").attr("class", "domain"),
                Bo.transition(x));
                v.append("line"),
                v.append("text");
                var _ = v.select("line")
                  , b = m.select("line")
                  , w = p.select("text").text(g)
                  , S = v.select("text")
                  , k = m.select("text");
                switch (r) {
                case "bottom":
                    n = oo,
                    _.attr("y2", u),
                    S.attr("y", Math.max(u, 0) + o),
                    b.attr("x2", 0).attr("y2", u),
                    k.attr("x", 0).attr("y", Math.max(u, 0) + o),
                    w.attr("dy", ".71em").style("text-anchor", "middle"),
                    M.attr("d", "M" + y[0] + "," + i + "V0H" + y[1] + "V" + i);
                    break;
                case "top":
                    n = oo,
                    _.attr("y2", -u),
                    S.attr("y", -(Math.max(u, 0) + o)),
                    b.attr("x2", 0).attr("y2", -u),
                    k.attr("x", 0).attr("y", -(Math.max(u, 0) + o)),
                    w.attr("dy", "0em").style("text-anchor", "middle"),
                    M.attr("d", "M" + y[0] + "," + -i + "V0H" + y[1] + "V" + -i);
                    break;
                case "left":
                    n = ao,
                    _.attr("x2", -u),
                    S.attr("x", -(Math.max(u, 0) + o)),
                    b.attr("x2", -u).attr("y2", 0),
                    k.attr("x", -(Math.max(u, 0) + o)).attr("y", 0),
                    w.attr("dy", ".32em").style("text-anchor", "end"),
                    M.attr("d", "M" + -i + "," + y[0] + "H0V" + y[1] + "H" + -i);
                    break;
                case "right":
                    n = ao,
                    _.attr("x2", u),
                    S.attr("x", Math.max(u, 0) + o),
                    b.attr("x2", u).attr("y2", 0),
                    k.attr("x", Math.max(u, 0) + o).attr("y", 0),
                    w.attr("dy", ".32em").style("text-anchor", "start"),
                    M.attr("d", "M" + i + "," + y[0] + "H0V" + y[1] + "H" + i)
                }
                if (f.rangeBand) {
                    var E = f
                      , A = E.rangeBand() / 2;
                    l = f = function(n) {
                        return E(n) + A
                    }
                } else
                    l.rangeBand ? l = f : d.call(n, f);
                v.call(n, l),
                m.call(n, f)
            })
        }
        var t, e = Bo.scale.linear(), r = Ts, u = 6, i = 6, o = 3, a = [10], c = null;
        return n.scale = function(t) {
            return arguments.length ? (e = t,
            n) : e
        }
        ,
        n.orient = function(t) {
            return arguments.length ? (r = t in qs ? t + "" : Ts,
            n) : r
        }
        ,
        n.ticks = function() {
            return arguments.length ? (a = arguments,
            n) : a
        }
        ,
        n.tickValues = function(t) {
            return arguments.length ? (c = t,
            n) : c
        }
        ,
        n.tickFormat = function(e) {
            return arguments.length ? (t = e,
            n) : t
        }
        ,
        n.tickSize = function(t) {
            var e = arguments.length;
            return e ? (u = +t,
            i = +arguments[e - 1],
            n) : u
        }
        ,
        n.innerTickSize = function(t) {
            return arguments.length ? (u = +t,
            n) : u
        }
        ,
        n.outerTickSize = function(t) {
            return arguments.length ? (i = +t,
            n) : i
        }
        ,
        n.tickPadding = function(t) {
            return arguments.length ? (o = +t,
            n) : o
        }
        ,
        n.tickSubdivide = function() {
            return arguments.length && n
        }
        ,
        n
    }
    ;
    var Ts = "bottom"
      , qs = {
        top: 1,
        right: 1,
        bottom: 1,
        left: 1
    };
    Bo.svg.brush = function() {
        function n(i) {
            i.each(function() {
                var i = Bo.select(this).style("pointer-events", "all").style("-webkit-tap-highlight-color", "rgba(0,0,0,0)").on("mousedown.brush", u).on("touchstart.brush", u)
                  , o = i.selectAll(".background").data([0]);
                o.enter().append("rect").attr("class", "background").style("visibility", "hidden").style("cursor", "crosshair"),
                i.selectAll(".extent").data([0]).enter().append("rect").attr("class", "extent").style("cursor", "move");
                var a = i.selectAll(".resize").data(d, dt);
                a.exit().remove(),
                a.enter().append("g").attr("class", function(n) {
                    return "resize " + n
                }).style("cursor", function(n) {
                    return zs[n]
                }).append("rect").attr("x", function(n) {
                    return /[ew]$/.test(n) ? -3 : null
                }).attr("y", function(n) {
                    return /^[ns]/.test(n) ? -3 : null
                }).attr("width", 6).attr("height", 6).style("visibility", "hidden"),
                a.style("display", n.empty() ? "none" : null);
                var l, f = Bo.transition(i), h = Bo.transition(o);
                c && (l = ei(c),
                h.attr("x", l[0]).attr("width", l[1] - l[0]),
                e(f)),
                s && (l = ei(s),
                h.attr("y", l[0]).attr("height", l[1] - l[0]),
                r(f)),
                t(f)
            })
        }
        function t(n) {
            n.selectAll(".resize").attr("transform", function(n) {
                return "translate(" + l[+/e$/.test(n)] + "," + h[+/^s/.test(n)] + ")"
            })
        }
        function e(n) {
            n.select(".extent").attr("x", l[0]),
            n.selectAll(".extent,.n>rect,.s>rect").attr("width", l[1] - l[0])
        }
        function r(n) {
            n.select(".extent").attr("y", h[0]),
            n.selectAll(".extent,.e>rect,.w>rect").attr("height", h[1] - h[0])
        }
        function u() {
            function u() {
                32 == Bo.event.keyCode && (C || (x = null,
                L[0] -= l[1],
                L[1] -= h[1],
                C = 2),
                f())
            }
            function g() {
                32 == Bo.event.keyCode && 2 == C && (L[0] += l[1],
                L[1] += h[1],
                C = 0,
                f())
            }
            function d() {
                var n = Bo.mouse(_)
                  , u = !1;
                M && (n[0] += M[0],
                n[1] += M[1]),
                C || (Bo.event.altKey ? (x || (x = [(l[0] + l[1]) / 2, (h[0] + h[1]) / 2]),
                L[0] = l[+(n[0] < x[0])],
                L[1] = h[+(n[1] < x[1])]) : x = null),
                E && m(n, c, 0) && (e(S),
                u = !0),
                A && m(n, s, 1) && (r(S),
                u = !0),
                u && (t(S),
                w({
                    type: "brush",
                    mode: C ? "move" : "resize"
                }))
            }
            function m(n, t, e) {
                var r, u, a = ei(t), c = a[0], s = a[1], f = L[e], g = e ? h : l, d = g[1] - g[0];
                return C && (c -= f,
                s -= d + f),
                r = (e ? v : p) ? Math.max(c, Math.min(s, n[e])) : n[e],
                C ? u = (r += f) + d : (x && (f = Math.max(c, Math.min(s, 2 * x[e] - r))),
                r > f ? (u = r,
                r = f) : u = f),
                g[0] != r || g[1] != u ? (e ? o = null : i = null,
                g[0] = r,
                g[1] = u,
                !0) : void 0
            }
            function y() {
                d(),
                S.style("pointer-events", "all").selectAll(".resize").style("display", n.empty() ? "none" : null),
                Bo.select("body").style("cursor", null),
                T.on("mousemove.brush", null).on("mouseup.brush", null).on("touchmove.brush", null).on("touchend.brush", null).on("keydown.brush", null).on("keyup.brush", null),
                N(),
                w({
                    type: "brushend"
                })
            }
            var x, M, _ = this, b = Bo.select(Bo.event.target), w = a.of(_, arguments), S = Bo.select(_), k = b.datum(), E = !/^(n|s)$/.test(k) && c, A = !/^(e|w)$/.test(k) && s, C = b.classed("extent"), N = P(), L = Bo.mouse(_), T = Bo.select(Qo).on("keydown.brush", u).on("keyup.brush", g);
            if (Bo.event.changedTouches ? T.on("touchmove.brush", d).on("touchend.brush", y) : T.on("mousemove.brush", d).on("mouseup.brush", y),
            S.interrupt().selectAll("*").interrupt(),
            C)
                L[0] = l[0] - L[0],
                L[1] = h[0] - L[1];
            else if (k) {
                var q = +/w$/.test(k)
                  , z = +/^n/.test(k);
                M = [l[1 - q] - L[0], h[1 - z] - L[1]],
                L[0] = l[q],
                L[1] = h[z]
            } else
                Bo.event.altKey && (x = L.slice());
            S.style("pointer-events", "none").selectAll(".resize").style("display", null),
            Bo.select("body").style("cursor", b.style("cursor")),
            w({
                type: "brushstart"
            }),
            d()
        }
        var i, o, a = g(n, "brushstart", "brush", "brushend"), c = null, s = null, l = [0, 0], h = [0, 0], p = !0, v = !0, d = Rs[0];
        return n.event = function(n) {
            n.each(function() {
                var n = a.of(this, arguments)
                  , t = {
                    x: l,
                    y: h,
                    i: i,
                    j: o
                }
                  , e = this.__chart__ || t;
                this.__chart__ = t,
                ks ? Bo.select(this).transition().each("start.brush", function() {
                    i = e.i,
                    o = e.j,
                    l = e.x,
                    h = e.y,
                    n({
                        type: "brushstart"
                    })
                }).tween("brush:brush", function() {
                    var e = Rr(l, t.x)
                      , r = Rr(h, t.y);
                    return i = o = null,
                    function(u) {
                        l = t.x = e(u),
                        h = t.y = r(u),
                        n({
                            type: "brush",
                            mode: "resize"
                        })
                    }
                }).each("end.brush", function() {
                    i = t.i,
                    o = t.j,
                    n({
                        type: "brush",
                        mode: "resize"
                    }),
                    n({
                        type: "brushend"
                    })
                }) : (n({
                    type: "brushstart"
                }),
                n({
                    type: "brush",
                    mode: "resize"
                }),
                n({
                    type: "brushend"
                }))
            })
        }
        ,
        n.x = function(t) {
            return arguments.length ? (c = t,
            d = Rs[!c << 1 | !s],
            n) : c
        }
        ,
        n.y = function(t) {
            return arguments.length ? (s = t,
            d = Rs[!c << 1 | !s],
            n) : s
        }
        ,
        n.clamp = function(t) {
            return arguments.length ? (c && s ? (p = !!t[0],
            v = !!t[1]) : c ? p = !!t : s && (v = !!t),
            n) : c && s ? [p, v] : c ? p : s ? v : null
        }
        ,
        n.extent = function(t) {
            var e, r, u, a, f;
            return arguments.length ? (c && (e = t[0],
            r = t[1],
            s && (e = e[0],
            r = r[0]),
            i = [e, r],
            c.invert && (e = c(e),
            r = c(r)),
            e > r && (f = e,
            e = r,
            r = f),
            (e != l[0] || r != l[1]) && (l = [e, r])),
            s && (u = t[0],
            a = t[1],
            c && (u = u[1],
            a = a[1]),
            o = [u, a],
            s.invert && (u = s(u),
            a = s(a)),
            u > a && (f = u,
            u = a,
            a = f),
            (u != h[0] || a != h[1]) && (h = [u, a])),
            n) : (c && (i ? (e = i[0],
            r = i[1]) : (e = l[0],
            r = l[1],
            c.invert && (e = c.invert(e),
            r = c.invert(r)),
            e > r && (f = e,
            e = r,
            r = f))),
            s && (o ? (u = o[0],
            a = o[1]) : (u = h[0],
            a = h[1],
            s.invert && (u = s.invert(u),
            a = s.invert(a)),
            u > a && (f = u,
            u = a,
            a = f))),
            c && s ? [[e, u], [r, a]] : c ? [e, r] : s && [u, a])
        }
        ,
        n.clear = function() {
            return n.empty() || (l = [0, 0],
            h = [0, 0],
            i = o = null),
            n
        }
        ,
        n.empty = function() {
            return !!c && l[0] == l[1] || !!s && h[0] == h[1]
        }
        ,
        Bo.rebind(n, a, "on")
    }
    ;
    var zs = {
        n: "ns-resize",
        e: "ew-resize",
        s: "ns-resize",
        w: "ew-resize",
        nw: "nwse-resize",
        ne: "nesw-resize",
        se: "nwse-resize",
        sw: "nesw-resize"
    }
      , Rs = [["n", "e", "s", "w", "nw", "ne", "se", "sw"], ["e", "w"], ["n", "s"], []]
      , Ds = Bo.time = {}
      , Ps = Date
      , Us = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    co.prototype = {
        getDate: function() {
            return this._.getUTCDate()
        },
        getDay: function() {
            return this._.getUTCDay()
        },
        getFullYear: function() {
            return this._.getUTCFullYear()
        },
        getHours: function() {
            return this._.getUTCHours()
        },
        getMilliseconds: function() {
            return this._.getUTCMilliseconds()
        },
        getMinutes: function() {
            return this._.getUTCMinutes()
        },
        getMonth: function() {
            return this._.getUTCMonth()
        },
        getSeconds: function() {
            return this._.getUTCSeconds()
        },
        getTime: function() {
            return this._.getTime()
        },
        getTimezoneOffset: function() {
            return 0
        },
        valueOf: function() {
            return this._.valueOf()
        },
        setDate: function() {
            js.setUTCDate.apply(this._, arguments)
        },
        setDay: function() {
            js.setUTCDay.apply(this._, arguments)
        },
        setFullYear: function() {
            js.setUTCFullYear.apply(this._, arguments)
        },
        setHours: function() {
            js.setUTCHours.apply(this._, arguments)
        },
        setMilliseconds: function() {
            js.setUTCMilliseconds.apply(this._, arguments)
        },
        setMinutes: function() {
            js.setUTCMinutes.apply(this._, arguments)
        },
        setMonth: function() {
            js.setUTCMonth.apply(this._, arguments)
        },
        setSeconds: function() {
            js.setUTCSeconds.apply(this._, arguments)
        },
        setTime: function() {
            js.setTime.apply(this._, arguments)
        }
    };
    var js = Date.prototype
      , Hs = "%a %b %e %X %Y"
      , Fs = "%m/%d/%Y"
      , Os = "%H:%M:%S"
      , Ys = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      , Is = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      , Zs = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
      , Vs = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    Ds.year = so(function(n) {
        return n = Ds.day(n),
        n.setMonth(0, 1),
        n
    }, function(n, t) {
        n.setFullYear(n.getFullYear() + t)
    }, function(n) {
        return n.getFullYear()
    }),
    Ds.years = Ds.year.range,
    Ds.years.utc = Ds.year.utc.range,
    Ds.day = so(function(n) {
        var t = new Ps(2e3,0);
        return t.setFullYear(n.getFullYear(), n.getMonth(), n.getDate()),
        t
    }, function(n, t) {
        n.setDate(n.getDate() + t)
    }, function(n) {
        return n.getDate() - 1
    }),
    Ds.days = Ds.day.range,
    Ds.days.utc = Ds.day.utc.range,
    Ds.dayOfYear = function(n) {
        var t = Ds.year(n);
        return Math.floor((n - t - 6e4 * (n.getTimezoneOffset() - t.getTimezoneOffset())) / 864e5)
    }
    ,
    Us.forEach(function(n, t) {
        n = n.toLowerCase(),
        t = 7 - t;
        var e = Ds[n] = so(function(n) {
            return (n = Ds.day(n)).setDate(n.getDate() - (n.getDay() + t) % 7),
            n
        }, function(n, t) {
            n.setDate(n.getDate() + 7 * Math.floor(t))
        }, function(n) {
            var e = Ds.year(n).getDay();
            return Math.floor((Ds.dayOfYear(n) + (e + t) % 7) / 7) - (e !== t)
        });
        Ds[n + "s"] = e.range,
        Ds[n + "s"].utc = e.utc.range,
        Ds[n + "OfYear"] = function(n) {
            var e = Ds.year(n).getDay();
            return Math.floor((Ds.dayOfYear(n) + (e + t) % 7) / 7)
        }
    }),
    Ds.week = Ds.sunday,
    Ds.weeks = Ds.sunday.range,
    Ds.weeks.utc = Ds.sunday.utc.range,
    Ds.weekOfYear = Ds.sundayOfYear,
    Ds.format = fo;
    var Xs = go(Ys)
      , $s = po(Ys)
      , Bs = go(Is)
      , Ws = po(Is)
      , Js = go(Zs)
      , Gs = po(Zs)
      , Ks = go(Vs)
      , Qs = po(Vs)
      , nl = /^%/
      , tl = {
        "-": "",
        _: " ",
        0: "0"
    }
      , el = {
        a: function(n) {
            return Is[n.getDay()]
        },
        A: function(n) {
            return Ys[n.getDay()]
        },
        b: function(n) {
            return Vs[n.getMonth()]
        },
        B: function(n) {
            return Zs[n.getMonth()]
        },
        c: fo(Hs),
        d: function(n, t) {
            return vo(n.getDate(), t, 2)
        },
        e: function(n, t) {
            return vo(n.getDate(), t, 2)
        },
        H: function(n, t) {
            return vo(n.getHours(), t, 2)
        },
        I: function(n, t) {
            return vo(n.getHours() % 12 || 12, t, 2)
        },
        j: function(n, t) {
            return vo(1 + Ds.dayOfYear(n), t, 3)
        },
        L: function(n, t) {
            return vo(n.getMilliseconds(), t, 3)
        },
        m: function(n, t) {
            return vo(n.getMonth() + 1, t, 2)
        },
        M: function(n, t) {
            return vo(n.getMinutes(), t, 2)
        },
        p: function(n) {
            return n.getHours() >= 12 ? "PM" : "AM"
        },
        S: function(n, t) {
            return vo(n.getSeconds(), t, 2)
        },
        U: function(n, t) {
            return vo(Ds.sundayOfYear(n), t, 2)
        },
        w: function(n) {
            return n.getDay()
        },
        W: function(n, t) {
            return vo(Ds.mondayOfYear(n), t, 2)
        },
        x: fo(Fs),
        X: fo(Os),
        y: function(n, t) {
            return vo(n.getFullYear() % 100, t, 2)
        },
        Y: function(n, t) {
            return vo(n.getFullYear() % 1e4, t, 4)
        },
        Z: Ho,
        "%": function() {
            return "%"
        }
    }
      , rl = {
        a: mo,
        A: yo,
        b: bo,
        B: wo,
        c: So,
        d: qo,
        e: qo,
        H: Ro,
        I: Ro,
        j: zo,
        L: Uo,
        m: To,
        M: Do,
        p: jo,
        S: Po,
        U: Mo,
        w: xo,
        W: _o,
        x: ko,
        X: Eo,
        y: Co,
        Y: Ao,
        Z: No,
        "%": Fo
    }
      , ul = /^\s*\d+/
      , il = Bo.map({
        am: 0,
        pm: 1
    });
    fo.utc = Oo;
    var ol = Oo("%Y-%m-%dT%H:%M:%S.%LZ");
    fo.iso = Date.prototype.toISOString && +new Date("2000-01-01T00:00:00.000Z") ? Yo : ol,
    Yo.parse = function(n) {
        var t = new Date(n);
        return isNaN(t) ? null : t
    }
    ,
    Yo.toString = ol.toString,
    Ds.second = so(function(n) {
        return new Ps(1e3 * Math.floor(n / 1e3))
    }, function(n, t) {
        n.setTime(n.getTime() + 1e3 * Math.floor(t))
    }, function(n) {
        return n.getSeconds()
    }),
    Ds.seconds = Ds.second.range,
    Ds.seconds.utc = Ds.second.utc.range,
    Ds.minute = so(function(n) {
        return new Ps(6e4 * Math.floor(n / 6e4))
    }, function(n, t) {
        n.setTime(n.getTime() + 6e4 * Math.floor(t))
    }, function(n) {
        return n.getMinutes()
    }),
    Ds.minutes = Ds.minute.range,
    Ds.minutes.utc = Ds.minute.utc.range,
    Ds.hour = so(function(n) {
        var t = n.getTimezoneOffset() / 60;
        return new Ps(36e5 * (Math.floor(n / 36e5 - t) + t))
    }, function(n, t) {
        n.setTime(n.getTime() + 36e5 * Math.floor(t))
    }, function(n) {
        return n.getHours()
    }),
    Ds.hours = Ds.hour.range,
    Ds.hours.utc = Ds.hour.utc.range,
    Ds.month = so(function(n) {
        return n = Ds.day(n),
        n.setDate(1),
        n
    }, function(n, t) {
        n.setMonth(n.getMonth() + t)
    }, function(n) {
        return n.getMonth()
    }),
    Ds.months = Ds.month.range,
    Ds.months.utc = Ds.month.utc.range;
    var al = [1e3, 5e3, 15e3, 3e4, 6e4, 3e5, 9e5, 18e5, 36e5, 108e5, 216e5, 432e5, 864e5, 1728e5, 6048e5, 2592e6, 7776e6, 31536e6]
      , cl = [[Ds.second, 1], [Ds.second, 5], [Ds.second, 15], [Ds.second, 30], [Ds.minute, 1], [Ds.minute, 5], [Ds.minute, 15], [Ds.minute, 30], [Ds.hour, 1], [Ds.hour, 3], [Ds.hour, 6], [Ds.hour, 12], [Ds.day, 1], [Ds.day, 2], [Ds.week, 1], [Ds.month, 1], [Ds.month, 3], [Ds.year, 1]]
      , sl = [[fo("%Y"), Vt], [fo("%B"), function(n) {
        return n.getMonth()
    }
    ], [fo("%b %d"), function(n) {
        return 1 != n.getDate()
    }
    ], [fo("%a %d"), function(n) {
        return n.getDay() && 1 != n.getDate()
    }
    ], [fo("%I %p"), function(n) {
        return n.getHours()
    }
    ], [fo("%I:%M"), function(n) {
        return n.getMinutes()
    }
    ], [fo(":%S"), function(n) {
        return n.getSeconds()
    }
    ], [fo(".%L"), function(n) {
        return n.getMilliseconds()
    }
    ]]
      , ll = Vo(sl);
    cl.year = Ds.year,
    Ds.scale = function() {
        return Io(Bo.scale.linear(), cl, ll)
    }
    ;
    var fl = {
        range: function(n, t, e) {
            return Bo.range(+n, +t, e).map(Zo)
        },
        floor: dt,
        ceil: dt
    }
      , hl = cl.map(function(n) {
        return [n[0].utc, n[1]]
    })
      , gl = [[Oo("%Y"), Vt], [Oo("%B"), function(n) {
        return n.getUTCMonth()
    }
    ], [Oo("%b %d"), function(n) {
        return 1 != n.getUTCDate()
    }
    ], [Oo("%a %d"), function(n) {
        return n.getUTCDay() && 1 != n.getUTCDate()
    }
    ], [Oo("%I %p"), function(n) {
        return n.getUTCHours()
    }
    ], [Oo("%I:%M"), function(n) {
        return n.getUTCMinutes()
    }
    ], [Oo(":%S"), function(n) {
        return n.getUTCSeconds()
    }
    ], [Oo(".%L"), function(n) {
        return n.getUTCMilliseconds()
    }
    ]]
      , pl = Vo(gl);
    return hl.year = Ds.year.utc,
    Ds.scale.utc = function() {
        return Io(Bo.scale.linear(), hl, pl)
    }
    ,
    Bo.text = mt(function(n) {
        return n.responseText
    }),
    Bo.json = function(n, t) {
        return yt(n, "application/json", Xo, t)
    }
    ,
    Bo.html = function(n, t) {
        return yt(n, "text/html", $o, t)
    }
    ,
    Bo.xml = mt(function(n) {
        return n.responseXML
    }),
    Bo
}();

function _p2settings() {
    const _ups = new URLSearchParams(window.location.search);
    if (_ups && _ups.get('constellation')) {
        settings.group = _ups.get('constellation');
        const url = new URL(window.location);
        window.history.pushState({}, document.title = 'Constellation ' + settings.group + ' - current positions', url);
    }

    if (_ups && _ups.get('minimal')) {
        document.getElementById('pageheader').style.display = 'none';
        document.getElementById('fab').style.display = 'none';
        document.getElementById('footer').style.display = 'none';
        document.getElementById('latency').style.display = 'none';
        document.getElementById('msearch').style.display = 'none';
    }

    if (_ups && _ups.get('rotating')) {
        settings.rotating = true;
    } else {
        settings.rotating = false;
    }

}

function munge(x, y, z) {
    if (Math.random() > 0.95)
        console.log(x.toFixed(3), y.toFixed(3), z.toFixed(3));
}

function device_heading(o) {
    try {
        if (ppp) {
            settings.myloc[0] = o.lat;
            settings.myloc[1] = o.lng;
            ppp.device_heading = o;
        }
    } catch (e) {
        console.error(typeof (ppp));
        console.error(e);
    }
}

function goForAR() {
    if (mylocok())
        StackView.postMessage('3');
    else
        myalert("Please set home location in Settings");
}

function mylocok() {
    if (settings.myloc && settings.myloc.length == 2 && settings.myloc[0].match(/^[0-9-.]+/) && settings.myloc[1].match(/^[0-9-.]+/))
        return true;
    return false;
}

function pulse(id, pid) {
    var v = document.getElementById(id).checked;
    el = document.getElementById(pid);
    if (!el)
        return;
    if (v) {
        el.classList.add("fab-pulse-blue");
    } else {
        el.classList.remove("fab-pulse-blue");
    }
}

function modal_content(t, s) {
    document.getElementById('modal3-title').innerHTML = t;
    document.getElementById('modal3-content').innerHTML = s;
    document.getElementById('modal3') ? document.getElementById('modal3').classList.add(isVisible) : "";
}

function ccoll(id) {
    const elp = document.getElementById(id);
    const el = document.getElementById(id + "-content");
    el.classList.remove("concertina-show");
    el.classList.add("concertina-hidden");
    elp.classList.remove("ch-show");
    elp.classList.add("ch-hidden");
}

function cflip(id) {
    const elp = document.getElementById(id);
    const el = document.getElementById(id + "-content");

    if (id != 'c1')
        ccoll('c1');
    if (id != 'c2')
        ccoll('c2');
    if (id != 'c3')
        ccoll('c3');
    if (id != 'f1')
        ccoll('f1');
    if (id != 'f2')
        ccoll('f2');
    if (el.classList.contains("concertina-show")) {
        el.classList.remove("concertina-show");
        el.classList.add("concertina-hidden");
        elp.classList.remove("ch-show");
        elp.classList.add("ch-hidden");
    } else {
        el.classList.remove("concertina-hidden");
        el.classList.add("concertina-show");
        elp.classList.remove("ch-hidden");
        elp.classList.add("ch-show");
    }
}

function reset_settings() {
    settings = new Object();

    settings.group = 'starlink';
    settings.launch = 'all';
    settings.satver = 'all';
    settings.myloc = new Array();
    settings.show = 'all';
    settings.dishyface = '';
    settings.projection = 'orthographic';
    settings.redwhite = false;
    settings.showrings = false;
    settings.showcov = true;
    settings.showintensity = false;
    settings.showpeeps = "no";
    settings.showgnd = true;
    settings.theme = 'dark';
    settings.of = '';
    settings.tf = '';

    window.localStorage.setItem('settings', JSON.stringify(settings));
}

function success(pos) {
    var crd = pos.coords;

    document.getElementById("getlocn").innerHTML = "get location";
    document.getElementById("settings.myloc0").value = crd.latitude.toFixed(4);
    document.getElementById("settings.myloc1").value = crd.longitude.toFixed(4);
}

function myalert(msg) {
    if (typeof (window.Flutteralert) == 'object') {
        window.Flutteralert.postMessage(msg);
    } else if (typeof alert == 'function') {
        alert(msg);
    } else {
        console.error("no alert ", msg);
    }
}

function error(error) {
    if (error.code == error.PERMISSION_DENIED) {
        if (typeof (window.StackView) == 'object') {
            window.StackView.postMessage("geolocate");
            return;
        }
    }
    document.getElementById("getlocn").innerHTML = "error";
    switch (error.code) {
    case error.PERMISSION_DENIED:
        myalert("Permission error.");
        break;
    case error.POSITION_UNAVAILABLE:
        myalert("Location information is unavailable.");
        break;
    case error.TIMEOUT:
        myalert("The request to get user location timed out.");
        break;
    case error.UNKNOWN_ERROR:
        myalert("An unknown error occurred with geolocation.");
        break;
    }
    console.warn(`ERROR(${error.code}): ${error.message}`);
}

function modal_open(id) {
    var l = ['modal0', 'modal1', 'modal2', 'modal4', 'modal5', 'modal6'];

    for (var x = 0; x < l.length; x++) {
        var m = document.getElementById(l[x]);
        if (m && m.classList.contains(isVisible))
            m.classList.remove(isVisible);
        if (m && l[x] == id)
            m.classList.add(isVisible);
    }
}

function modal_toggle(id) {
    var l = ['modal0', 'modal1', 'modal2', 'modal4', 'modal5'];

    for (var x = 0; x < l.length; x++) {
        var m = document.getElementById(l[x]);
        if (m && l[x] == id) {
            if (m && m.classList.contains(isVisible))
                m.classList.remove(isVisible);
            else {
                m.classList.add(isVisible);
                proc_event(id);
            }
        } else if (m && m.classList.contains(isVisible))
            m.classList.remove(isVisible);
    }
}

function latencybot(o, server) {
    if (!('WebSocket'in window && window.WebSocket.CLOSING === 2) || (settings && settings.scopemode))
        return null;

    if (!o)
        o = new Object();
    else if (o.webSocket && o.webSocket.readyState == 1) {
        console.log("already opened");
        return o;
    }

    try {
        o.webSocket = new WebSocket(server);

        if (!o.created) {
            o.created = new Date().getTime();
            o.sent = 0;
            o.pings = 0;
            o.stalls = 0;
            o.closes = 0;
            o.lastreply = 0;
            o.uniqping = 0;
            o.keepalive = 1;
        }
        o.errors = 0;

        var restart = function() {
            if (o.i_t) {
                clearInterval(o.i_t);
                o.i_t = null;
            }
            setTimeout(function() {
                if (o.keepalive) {
                    latencybot(o, server);
                }
            }, 7000 + Math.floor(Math.random() * 4000));
        };

        var pinger = function() {
            o.i_t = setInterval(function() {
                if (!isHidden()) {
                    o.sent++;
                    o.webSocket.send(new Date().getTime() + (o.uniqping ? " " + o.uniqping : " " + 0 + " " + o.lastreply));
                    {
                        var status = "";
                        if (!lb.i_t)
                            status = "--";
                        else if (lb.sent == 0 && lb.pings == 0)
                            status = "connect";
                        else if (lb.uniqping < 0 && lb.uniqping > -60)
                            status = -lb.uniqping + "s stall";
                        else if (lb.uniqping > 1000)
                            status = "+1s";
                        else if (lb.uniqping > 0)
                            status = lb.uniqping + "ms";
                        else if (lb.pings == 0)
                            status = "--";
                        else {
                            status = "--";
                        }
                        document.getElementById('latency').innerHTML = status;
                    }
                    if (o.lastreply) {
                        if (o.uniqping > 0)
                            o.uniqping = 0;
                        else {
                            if (o.uniqping-- == -60) {
                                o.webSocket.close();
                                restart();
                            }
                        }
                    }
                }
            }, 1000);
            var uuid = window.localStorage.getItem('uuid');
            o.webSocket.send(uuid ? "s " + uuid : "s");
        };

        o.webSocket.onopen = pinger;

        o.webSocket.onmessage = function(msg) {
            if (msg.data.indexOf("s") !== -1) {
                const words = msg.data.split(' ');
                if (words[1])
                    window.localStorage.setItem('uuid', words[1]);
            } else if (msg.data == 'ping') {// ignore
            } else {
                var t = new Date().getTime();
                var ms = t - msg.data;
                if (ms > 1000)
                    o.stalls++;
                o.pings++;
                o.ms = ms;
                o.uniqping = ms;
                o.lastreply = t;
            }
        }

        o.webSocket.onclose = function(ev) {
            console.log("onclose", ev);
            o.closes++;
            restart()
        }

        o.webSocket.onerror = function(ev) {
            console.log("onerror", ev);
            if (o.errors++ == 1) {
                restart();
            }
        }
    } catch (exception) {
        console.error(exception);
    }
    return o;
}

function dolatency() {
    let params = (new URL(document.location)).searchParams;
    let name = params.get("latency");
    if (name != "no") {
        lb = latencybot(null, "wss://satellitemap.space:8089");
        document.getElementById('latency').style.display = 'block';
    } else {
        document.getElementById('latency').style.display = 'none';
    }
}

function get_location() {
    document.getElementById("getlocn").innerHTML = "fetching..";
    navigator.geolocation.getCurrentPosition(success, error, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
    });
}

function save_settings() {
    var reload = false;
    var a = document.getElementById("settings.launch").value;
    settings.launch = a;

    a = document.getElementById("settings.satver");
    if (a)
        settings.satver = a.value;

    if (settings.group != document.getElementById("settings.group").value) {
        reload = true;
    }
    settings.group = document.getElementById("settings.group").value;

    settings.show = document.getElementById("settings.show").value;
    settings.dishyface = document.getElementById("settings.dishyface").value;

    settings.showrings = false;
    settings.showcov = (document.getElementById("settings.showcov").checked ? true : false);
    settings.showintensity = (document.getElementById("settings.showintensity").checked ? true : false);
    settings.showpeeps = (document.getElementById("settings.showpeeps").value);
    settings.showgnd = (document.getElementById("settings.showgnd").checked ? true : false);
    settings.redwhite = (document.getElementById("settings.redwhite").checked ? true : false);
    settings.of = document.getElementById("settings.of").value;
    settings.tf = document.getElementById("settings.tf").value;

    if (settings.theme != document.getElementById("settings.theme").value) {
        settings.theme = document.getElementById("settings.theme").value;
        reload = true;
    }

    if (settings.myloc[0] != document.getElementById("settings.myloc0").value || (settings.myloc[1] != document.getElementById("settings.myloc1").value)) {
        reload = true;
    }

    settings.myloc[0] = document.getElementById("settings.myloc0").value;
    settings.myloc[1] = document.getElementById("settings.myloc1").value;

    if (document.getElementById("settings.projection").value != settings.projection) {
        settings.projection = document.getElementById("settings.projection").value;
        ppp.setProjection(settings.projection);
    }

    window.localStorage.setItem('settings', JSON.stringify(settings));

    ppp.setSettings(settings);

    // ppp.plugins.myloc.set([settings.myloc[1], settings.myloc[0]]);

    document.getElementById("magnitudes").innerHTML = "";

    last_fetched = new Date().getTime() - 120000;

    if (reload) {
        window.location.reload(false);
    }
}

function tog_showing() {
    var i = document.getElementById('showing_on');
    var j = document.getElementById('showing_off');
    var ic = window.getComputedStyle(document.getElementById('showing_on'));

    if (ic.display == 'none') {
        i.style.display = 'block';
        j.style.display = 'none';
    } else {
        i.style.display = 'none';
        j.style.display = 'block';
    }
    return false;
}

function close_modal(m) {
    m.classList.remove(isVisible);
}

function exportToCsv(filename, rows) {
    if (typeof (window.StackView) == 'object') {
        myalert("Function not yet implemented from app");
        return;
    }

    var processRow = function(row) {
        var finalVal = '';
        for (var j = 0; j < row.length; j++) {
            var innerValue = row[j] === null ? '' : row[j].toString();
            if (row[j]instanceof Date) {
                innerValue = row[j].toLocaleString();
            }
            ;var result = innerValue.replace(/"/g, '""');
            if (result.search(/("|,|\n)/g) >= 0)
                result = '"' + result + '"';
            if (j > 0)
                finalVal += ',';
            finalVal += result;
        }
        return finalVal + '\n';
    };

    var csvFile = '';
    for (var i = 0; i < rows.length; i++) {
        csvFile += processRow(rows[i]);
    }
    var blob = new Blob([csvFile],{
        type: 'text/csv;charset=utf-8;'
    });
    if (navigator.msSaveBlob) {
        // IE 10+
        navigator.msSaveBlob(blob, filename);
    } else {
        var link = document.createElement("a");
        if (link.download !== undefined) {
            // feature detection
            // Browsers that support HTML5 download attribute
            var url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            setTimeout(function() {
                link.click();
                document.body.removeChild(link);
            }, 100);
        }
    }
}

function proc_click(id) {
    if (id == 'search' || id == 'msearch') {
        el = document.getElementById(id == 'search' ? 'autocomplete' : 'mautocomplete');
        if (el.style.display == 'none') {
            el.style.display = (el.style.display == 'none' ? '' : 'none');
            if (el.style.display == '') {
                el.focus();
                autocomplete_result.value = '';
                if (!el.hasAttribute('listenerOnClick')) {
                    el.setAttribute('listenerOnClick', 'true');

                    el.addEventListener("keyup", e=>{
                        if (e.key == "Escape") {
                            el.style.display = 'none';
                            autocomplete_result.style.display = 'none';
                        } else if (e.key == "Enter") {
                            var elc = document.getElementById("searchfirst");
                            if (elc) {
                                elc.click();
                            }
                        } else {
                            updPopup(el);
                        }
                    }
                    );
                }
            }
        } else {
            el.style.display = 'none';
            autocomplete_result.style.display = 'none';
        }
    }
}

function popupClearAndHide() {
    autocomplete_result.innerHTML = "";
    autocomplete_result.style.display = "none";
}

function updPopup(el) {

    if (!el.value) {
        popupClearAndHide();
        return;
    }

    if (el.value == 'help') {
        modal_open('modal6');
        return;
    }

    var m1 = ppp.plugins.pings.isearch(el.value);
    var m2 = (ppp.plugins.basestations ? ppp.plugins.basestations.isearch(el.value) : []);
    var m3 = (ppp.plugins.tips ? ppp.plugins.tips.isearch(el.value) : []);

    var m = m1.concat(m2.concat(m3));

    if (m.length)
        for (var x = 0, b = document.createDocumentFragment(), c = false; x < m.length; x++) {
            c = true;

            var d = document.createElement("p");
            d.innerText = m[x].m;
            d.setAttribute("data-isearch", "a");
            d.setAttribute("data-lng", m[x].ll[1]);
            d.setAttribute("data-lat", m[x].ll[0]);
            d.setAttribute("data-typ", m[x].typ);
            d.setAttribute("data-id", m[x].id);
            if (x == 0)
                d.setAttribute("id", "searchfirst");

            d.addEventListener("click", function() {
                el.value = this.innerText;
                autocomplete_result.innerHTML = '';
                autocomplete_result.style.display = 'none';
                var l1 = this.getAttribute('data-lng');
                var l2 = this.getAttribute('data-lat');
                var typ = this.getAttribute('data-typ');
                var id = this.getAttribute('data-id');

                ppp.plugins.myloc.gospot(ppp, l1, l2);
                if (typ == 'satellite' || typ == 'launch') {
                    for (var x = 0; x < showingsats.length; x++)
                        if (showingsats[x].id == id) {
                            selected[x] = true;
                            ppp.plugins.pings.sel(x, ppp, true);
                        }
                }
            });
            b.appendChild(d);
            if (x == 10)
                break;
        }

    if (c == true) {
        const rect = el.getBoundingClientRect();
        autocomplete_result.innerHTML = "";
        autocomplete_result.style.display = "block";
        autocomplete_result.appendChild(b);
        const left = rect.left;
        const top = rect.top;
        autocomplete_result.style.left = left + "px";
        autocomplete_result.style.top = (top + rect.height - 1) + "px";
        autocomplete_result.style.width = rect.width + "px";
        return;
    }
    popupClearAndHide();
}
// ------------------------------------------------------------------------------

function proc_event(modalId) {
    //document.getElementById(modalId) ? document.getElementById(modalId).classList.add(isVisible) : "";
    modal_open(modalId);
    if (modalId == 'visData') {
        var d = ppp.plugins.pings.visdata();
        if (d.length) {
            var rows = [["time", "name", "norad", "distance", "elevation", "azimuth", "link"]];
            d.forEach(function(r) {
                var row = [r.t, r.name, r.norad, r.dist, r.elev, r.az, r.vis ? 1 : 0];
                rows.push(row);
            });
            exportToCsv("visibility.csv", rows);
        } else {
            myalert("Set a home location and leave it running to accumulate visibility data you can download as a CSV file");
        }
    }
    if (modalId == 'goHome') {
        if (typeof (settings.myloc) == 'object' && settings.myloc.length == 2 && settings.myloc[0]) {
            ppp.plugins.myloc.gohome(ppp);
        } else {
            myalert("Home location not set in Settings");
        }
    }
    if (modalId == 'myDiv1') {
        graphCon();
    }
    if (modalId == 'myDiv2') {
        graphStatus();
    }
    if (modalId == 'modal2') {
        // set them all

        document.getElementById("settings.launch").value = settings.launch;
        var a = document.getElementById("settings.satver");
        if (a)
            a.value = (settings.satver ? settings.satver : "all");
        // setValues(null, (settings.launch == 'any' || settings.launch == 'all' ? 'all' : settings.launch));

        document.getElementById("settings.group").value = settings.group;
        document.getElementById("settings.show").value = settings.show;
        document.getElementById("settings.dishyface").value = settings.dishyface;
        document.getElementById("settings.projection").value = settings.projection;
        //document.getElementById("settings.showrings").checked = (settings.showrings ? 'checked' : '');
        document.getElementById("settings.showcov").checked = (settings.showcov ? 'checked' : '');
        document.getElementById("settings.showintensity").checked = (settings.showintensity ? 'checked' : '');
        document.getElementById("settings.showpeeps").value = settings.showpeeps;
        document.getElementById("settings.showgnd").checked = (settings.showgnd ? 'checked' : '');
        document.getElementById("settings.redwhite").checked = (settings.redwhite ? 'checked' : '');

        document.getElementById("settings.theme").value = (settings.theme ? settings.theme : 'dark');
        document.getElementById("settings.tf").value = (settings.tf ? settings.tf : '');
        document.getElementById("settings.myloc0").value = (settings.myloc[0] ? settings.myloc[0] : "");
        document.getElementById("settings.myloc1").value = (settings.myloc[1] ? settings.myloc[1] : "");
    }
}

function getHiddenProp() {
    var prefixes = ['webkit', 'moz', 'ms', 'o'];
    if ('hidden'in document)
        return 'hidden';
    for (var i = 0; i < prefixes.length; i++) {
        if ((prefixes[i] + 'Hidden')in document)
            return prefixes[i] + 'Hidden';
    }
    return null;
}

function isHidden() {
    var prop = getHiddenProp();
    if (!prop)
        return false;
    return document[prop];
}

function visChange() {
    if (settings && settings.scopemode) {
        return;
    }
    if (isHidden()) {
        if (ppp)
            ppp.stopped = true;
    } else {
        if (ppp)
            ppp.stopped = false;
    }
}

function doutc() {
    let params = (new URL(document.location)).searchParams;
    let name = params.get("utc");
    if (name == "1") {
        document.getElementById('latency').style.display = 'block';
        setInterval(function() {
            document.getElementById('latency').innerHTML = new Date().toUTCString()
        }, 1000);
    }
}

function check_changes(n, oo) {
    let o = (oo ? JSON.parse(oo) : null);
    if (n && o) {
        var d1 = n.total - o.total;
        var d2 = n.service - o.service;
        var d3 = n.burn - o.burn;
        var d4 = n.gs - o.gs;
        if (n.burn < o.burn)
            d3 = 0;
        if (d1 || d2 || d3 || d4) {
            var s = "";
            if (d1 > 0)
                d1 = "+" + d1;
            if (d2 > 0)
                d2 = "+" + d2;
            if (d3 > 0)
                d3 = "+" + d3;
            if (d4 > 0)
                d4 = "+" + d4;
            if (d1)
                s += ", " + d1 + " total";
            if (d2)
                s += ", " + d2 + " service";
            if (d3)
                s += ", " + d3 + " burned";
            if (d4)
                s += ", " + d4 + " ground stations";
            return "Since your last visit " + o.date + ":<br>" + s.slice(2);
        }
    }
    return null;
}

function dostatus() {
    let params = (new URL(document.location)).searchParams;
    let name = params.get("status");
    if (name != "no") {
        if (settings.group == 'starlink')
            fetch('/json/status.json').then(response=>response.json()).then(data=>{
                var latest = data.starlink[0];
                var s;
                document.getElementById('status-container').style.display = '';
                if (s = check_changes(latest, window.localStorage.getItem('last_status'))) {
                    document.getElementById('status-container').innerHTML = s;
                } else {
                    document.getElementById('status-container').innerHTML = latest.date + ": " + "🛰️ " + latest.total + "<br> ✅" + latest.service + " 🔥" + latest.burn;
                }
                window.tips = data.tips;
                window.localStorage.setItem('last_status', JSON.stringify(latest));
            }
            ).catch(error=>console.error(error));
    }
}

function geodGBL() {
    var tstglobal;
    tstglobal = typeof EARTH_A;
    if (tstglobal == "undefined")
        wgs84()
}
function earthcon(ai, bi) {
    var f, ecc, eccsq, a, b;
    a = Number(ai);
    b = Number(bi);
    f = 1 - b / a;
    eccsq = 1 - b * b / (a * a);
    ecc = Math.sqrt(eccsq);
    EARTH_A = a;
    EARTH_B = b;
    EARTH_F = f;
    EARTH_Ecc = ecc;
    EARTH_Esq = eccsq
}
function wgs84() {
    var wgs84a, wgs84b, wgs84f;
    wgs84a = 6378.137;
    wgs84f = 1 / 298.257223563;
    wgs84b = wgs84a * (1 - wgs84f);
    earthcon(wgs84a, wgs84b)
}
function radcur(lati) {
    var rrnrm = new Array(3);
    var dtr = Math.PI / 180;
    var a, b, lat;
    var asq, bsq, eccsq, ecc, clat, slat;
    var dsq, d, rn, rm, rho, rsq, r, z;
    geodGBL();
    a = EARTH_A;
    b = EARTH_B;
    asq = a * a;
    bsq = b * b;
    eccsq = 1 - bsq / asq;
    ecc = Math.sqrt(eccsq);
    lat = Number(lati);
    clat = Math.cos(dtr * lat);
    slat = Math.sin(dtr * lat);
    dsq = 1 - eccsq * slat * slat;
    d = Math.sqrt(dsq);
    rn = a / d;
    rm = rn * (1 - eccsq) / dsq;
    rho = rn * clat;
    z = (1 - eccsq) * rn * slat;
    rsq = rho * rho + z * z;
    r = Math.sqrt(rsq);
    rrnrm[0] = r;
    rrnrm[1] = rn;
    rrnrm[2] = rm;
    return rrnrm
}
function rearth(lati) {
    var rrnrm, r, lat;
    lat = Number(lati);
    rrnrm = radcur(lat);
    r = rrnrm[0];
    return r
}
function gc2gd(flatgci, altkmi) {
    var dtr = Math.PI / 180;
    var rtd = 1 / dtr;
    var flatgd, flatgc, altkm;
    var rrnrm = new Array(3);
    var re, rn, ecc, esq;
    var slat, clat, tlat;
    var altnow, ratio;
    geodGBL();
    flatgc = Number(flatgci);
    altkm = Number(altkmi);
    ecc = EARTH_Ecc;
    esq = ecc * ecc;
    altnow = altkm;
    rrnrm = radcur(flatgc);
    rn = rrnrm[1];
    ratio = 1 - esq * rn / (rn + altnow);
    tlat = Math.tan(dtr * flatgc) / ratio;
    flatgd = rtd * Math.atan(tlat);
    rrnrm = radcur(flatgd);
    rn = rrnrm[1];
    ratio = 1 - esq * rn / (rn + altnow);
    tlat = Math.tan(dtr * flatgc) / ratio;
    flatgd = rtd * Math.atan(tlat);
    return flatgd
}
function gd2gc(flatgdi, altkmi) {
    var dtr = Math.PI / 180;
    var rtd = 1 / dtr;
    var flatgc, flatgd, altkm;
    var rrnrm = new Array(3);
    var re, rn, ecc, esq;
    var slat, clat, tlat;
    var altnow, ratio;
    geodGBL();
    flatgd = Number(flatgdi);
    altkm = Number(altkmi);
    ecc = EARTH_Ecc;
    esq = ecc * ecc;
    altnow = altkm;
    rrnrm = radcur(flatgd);
    rn = rrnrm[1];
    ratio = 1 - esq * rn / (rn + altnow);
    tlat = Math.tan(dtr * flatgd) * ratio;
    flatgc = rtd * Math.atan(tlat);
    return flatgc
}
function llenu(flati, floni) {
    var flat, flon;
    var dtr, clat, slat, clon, slon;
    var ee = new Array(3);
    var en = new Array(3);
    var eu = new Array(3);
    var enu = new Array(3);
    var dtr = Math.PI / 180;
    flat = Number(flati);
    flon = Number(floni);
    clat = Math.cos(dtr * flat);
    slat = Math.sin(dtr * flat);
    clon = Math.cos(dtr * flon);
    slon = Math.sin(dtr * flon);
    ee[0] = -slon;
    ee[1] = clon;
    ee[2] = 0;
    en[0] = -clon * slat;
    en[1] = -slon * slat;
    en[2] = clat;
    eu[0] = clon * clat;
    eu[1] = slon * clat;
    eu[2] = slat;
    enu[0] = ee;
    enu[1] = en;
    enu[2] = eu;
    return enu
}
function llhxyz(flati, floni, altkmi) {
    var dtr = Math.PI / 180;
    var flat, flon, altkm;
    var clat, clon, slat, slon;
    var rrnrm = new Array(3);
    var rn, esq;
    var x, y, z;
    var xvec = new Array(3);
    geodGBL();
    flat = Number(flati);
    flon = Number(floni);
    altkm = Number(altkmi);
    clat = Math.cos(dtr * flat);
    slat = Math.sin(dtr * flat);
    clon = Math.cos(dtr * flon);
    slon = Math.sin(dtr * flon);
    rrnrm = radcur(flat);
    rn = rrnrm[1];
    re = rrnrm[0];
    ecc = EARTH_Ecc;
    esq = ecc * ecc;
    x = (rn + altkm) * clat * clon;
    y = (rn + altkm) * clat * slon;
    z = ((1 - esq) * rn + altkm) * slat;
    xvec[0] = x;
    xvec[1] = y;
    xvec[2] = z;
    return xvec
}
function xyzllh(xvec) {
    var dtr = Math.PI / 180;
    var flatgc, flatn, dlat;
    var rnow, rp;
    var x, y, z, p;
    var tangc, tangd;
    var testval, kount;
    var rn, esq;
    var clat, slat;
    var rrnrm = new Array(3);
    var flat, flon, altkm;
    var llhvec = new Array(3);
    geodGBL();
    esq = EARTH_Esq;
    x = xvec[0];
    y = xvec[1];
    z = xvec[2];
    x = Number(x);
    y = Number(y);
    z = Number(z);
    rp = Math.sqrt(x * x + y * y + z * z);
    flatgc = Math.asin(z / rp) / dtr;
    testval = Math.abs(x) + Math.abs(y);
    if (testval < 1e-10) {
        flon = 0
    } else {
        flon = Math.atan2(y, x) / dtr
    }
    if (flon < 0) {
        flon = flon + 360
    }
    p = Math.sqrt(x * x + y * y);
    if (p < 1e-10) {
        flat = 90;
        if (z < 0) {
            flat = -90
        }
        altkm = rp - rearth(flat);
        llhvec[0] = flat;
        llhvec[1] = flon;
        llhvec[2] = altkm;
        return llhvec
    }
    rnow = rearth(flatgc);
    altkm = rp - rnow;
    flat = gc2gd(flatgc, altkm);
    rrnrm = radcur(flat);
    rn = rrnrm[1];
    for (var kount = 0; kount < 5; kount++) {
        slat = Math.sin(dtr * flat);
        tangd = (z + rn * esq * slat) / p;
        flatn = Math.atan(tangd) / dtr;
        dlat = flatn - flat;
        flat = flatn;
        clat = Math.cos(dtr * flat);
        rrnrm = radcur(flat);
        rn = rrnrm[1];
        altkm = p / clat - rn;
        if (Math.abs(dlat) < 1e-12) {
            break
        }
    }
    llhvec[0] = flat;
    llhvec[1] = flon;
    llhvec[2] = altkm;
    return llhvec
}
